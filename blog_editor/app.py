from __future__ import annotations

import json
import os
import secrets
import shutil
import subprocess
import threading
import uuid
from datetime import date
from pathlib import Path

from flask import (
    Flask,
    abort,
    jsonify,
    redirect,
    render_template,
    request,
    send_from_directory,
    session,
    url_for,
)
from PIL import Image, UnidentifiedImageError
from werkzeug.utils import secure_filename

from .content import (
    article_document,
    read_article,
    sanitize_html,
    slugify,
    validate_article,
)


PUBLISH_LOCK = threading.Lock()
IMAGE_FORMATS = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp", "GIF": ".gif"}
MAX_UPLOAD_BYTES = 12 * 1024 * 1024


def create_app(config: dict | None = None) -> Flask:
    repo_root = Path(__file__).resolve().parent.parent
    app = Flask(__name__)
    app.config.from_mapping(
        SECRET_KEY=secrets.token_hex(32),
        REPO_ROOT=repo_root,
        DRAFT_ROOT=repo_root / ".blog-editor",
        MAX_CONTENT_LENGTH=MAX_UPLOAD_BYTES + 1024 * 1024,
        BUILD_COMMAND=["bundle", "exec", "jekyll", "build"],
        TESTING=False,
    )
    if config:
        app.config.update(config)
    app.config["REPO_ROOT"] = Path(app.config["REPO_ROOT"]).resolve()
    app.config["DRAFT_ROOT"] = Path(app.config["DRAFT_ROOT"]).resolve()
    app.config["DRAFT_ROOT"].mkdir(parents=True, exist_ok=True)

    @app.before_request
    def local_only():
        if request.remote_addr not in {"127.0.0.1", "::1", None}:
            abort(403)
        session.setdefault("csrf_token", secrets.token_urlsafe(32))

    @app.context_processor
    def editor_context():
        return {"csrf_token": session.get("csrf_token", "")}

    @app.get("/")
    def dashboard():
        articles = scan_articles(app.config["REPO_ROOT"])
        drafts = list_drafts(app.config["DRAFT_ROOT"])
        return render_template("dashboard.html", articles=articles, drafts=drafts)

    @app.get("/articles/new")
    def new_article():
        draft_id = request.args.get("draft", "")
        data = load_draft(app.config["DRAFT_ROOT"], draft_id) if draft_id else None
        data = (data or {}).get("data") or empty_article()
        return render_template("editor.html", article=data, draft_id=draft_id)

    @app.get("/articles/edit")
    def edit_article():
        relative = request.args.get("path", "")
        path = safe_repo_path(app.config["REPO_ROOT"], relative)
        if not path.is_file():
            abort(404)
        try:
            article = read_article(path, app.config["REPO_ROOT"])
        except (ValueError, OSError):
            abort(400)
        return render_template("editor.html", article=article, draft_id="")

    @app.post("/api/drafts")
    def save_draft_api():
        require_csrf()
        payload = request.get_json(silent=True) or {}
        draft_id = payload.get("draft_id") or str(uuid.uuid4())
        ensure_uuid(draft_id)
        data = normalize_article(payload.get("data") or {})
        save_draft(app.config["DRAFT_ROOT"], draft_id, data)
        return jsonify({"ok": True, "draft_id": draft_id})

    @app.post("/api/drafts/<draft_id>/delete")
    def delete_draft_api(draft_id: str):
        require_csrf()
        ensure_uuid(draft_id)
        shutil.rmtree(app.config["DRAFT_ROOT"] / draft_id, ignore_errors=True)
        return jsonify({"ok": True})

    @app.post("/api/uploads")
    def upload_api():
        require_csrf()
        draft_id = request.form.get("draft_id", "")
        ensure_uuid(draft_id)
        uploaded = request.files.get("file")
        if not uploaded or not uploaded.filename:
            return jsonify({"ok": False, "errors": ["Choose an image to upload."]}), 400
        try:
            filename = stage_upload(
                app.config["DRAFT_ROOT"],
                app.config["REPO_ROOT"],
                draft_id,
                uploaded,
            )
        except ValueError as exc:
            return jsonify({"ok": False, "errors": [str(exc)]}), 400
        return jsonify(
            {
                "ok": True,
                "url": url_for("draft_media", draft_id=draft_id, filename=filename),
                "filename": filename,
            }
        )

    @app.get("/draft-media/<draft_id>/<path:filename>")
    def draft_media(draft_id: str, filename: str):
        ensure_uuid(draft_id)
        return send_from_directory(app.config["DRAFT_ROOT"] / draft_id / "uploads", filename)

    @app.post("/api/publish")
    def publish_api():
        require_csrf()
        payload = request.get_json(silent=True) or {}
        draft_id = payload.get("draft_id") or str(uuid.uuid4())
        ensure_uuid(draft_id)
        data = normalize_article(payload.get("data") or {})
        save_draft(app.config["DRAFT_ROOT"], draft_id, data)
        errors = validate_article(data)
        if errors:
            return jsonify({"ok": False, "errors": errors}), 400
        try:
            result = publish_article(app, draft_id, data)
        except ValueError as exc:
            return jsonify({"ok": False, "errors": [str(exc)]}), 400
        status = 200 if result["ok"] else 422
        return jsonify(result), status

    @app.errorhandler(413)
    def upload_too_large(_error):
        return jsonify({"ok": False, "errors": ["Image exceeds the 12 MB upload limit."]}), 413

    return app


def empty_article() -> dict:
    return {
        "original_path": "",
        "heading": "",
        "seo_title": "",
        "slug": "",
        "date": date.today().isoformat(),
        "categories": ["GENAI"],
        "deck": "",
        "summary": "",
        "description": "",
        "keywords": "",
        "image": "",
        "content": "<p>Start writing…</p>",
    }


def normalize_article(data: dict) -> dict:
    normalized = empty_article()
    normalized.update({key: value for key, value in data.items() if key in normalized})
    categories = normalized.get("categories", [])
    if isinstance(categories, str):
        categories = categories.split(",")
    normalized["categories"] = [str(item).strip() for item in categories if str(item).strip()]
    for key in normalized:
        if key != "categories":
            normalized[key] = str(normalized[key] or "")
    normalized["slug"] = normalized["slug"].strip()
    return normalized


def require_csrf() -> None:
    supplied = request.headers.get("X-CSRF-Token") or request.form.get("csrf_token", "")
    expected = session.get("csrf_token", "")
    if not supplied or not expected or not secrets.compare_digest(supplied, expected):
        abort(400, "Invalid CSRF token")


def ensure_uuid(value: str) -> None:
    try:
        if str(uuid.UUID(value)) != value:
            raise ValueError
    except (ValueError, AttributeError):
        abort(400, "Invalid draft id")


def safe_repo_path(repo_root: Path, relative: str) -> Path:
    candidate = (repo_root / relative).resolve()
    if repo_root not in candidate.parents or candidate.suffix != ".html":
        abort(400)
    return candidate


def article_paths(repo_root: Path):
    for path in (repo_root / "blog").rglob("*.html"):
        try:
            if "\nlayout: article\n" in path.read_text(encoding="utf-8")[:1000]:
                yield path
        except OSError:
            continue


def scan_articles(repo_root: Path) -> list[dict]:
    articles = []
    for path in article_paths(repo_root):
        try:
            articles.append(read_article(path, repo_root))
        except (ValueError, OSError):
            continue
    return sorted(articles, key=lambda item: item["date"], reverse=True)


def draft_file(draft_root: Path, draft_id: str) -> Path:
    return draft_root / draft_id / "draft.json"


def save_draft(draft_root: Path, draft_id: str, data: dict) -> None:
    path = draft_file(draft_root, draft_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(
        json.dumps({"draft_id": draft_id, "data": data}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    os.replace(temporary, path)


def load_draft(draft_root: Path, draft_id: str) -> dict | None:
    ensure_uuid(draft_id)
    path = draft_file(draft_root, draft_id)
    if not path.is_file():
        abort(404)
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        abort(400)


def list_drafts(draft_root: Path) -> list[dict]:
    drafts = []
    for path in draft_root.glob("*/draft.json"):
        try:
            item = json.loads(path.read_text(encoding="utf-8"))
            data = item.get("data") or {}
            drafts.append(
                {
                    "draft_id": item["draft_id"],
                    "heading": data.get("heading") or "Untitled draft",
                    "date": data.get("date") or "",
                }
            )
        except (KeyError, json.JSONDecodeError, OSError):
            continue
    return sorted(drafts, key=lambda item: item["date"], reverse=True)


def unique_filename(directory: Path, base: str, suffix: str, extra_directory: Path | None = None) -> str:
    candidate = f"{base}{suffix}"
    counter = 2
    while (directory / candidate).exists() or (
        extra_directory is not None and (extra_directory / candidate).exists()
    ):
        candidate = f"{base}-{counter}{suffix}"
        counter += 1
    return candidate


def stage_upload(draft_root: Path, repo_root: Path, draft_id: str, uploaded) -> str:
    uploaded.stream.seek(0, os.SEEK_END)
    size = uploaded.stream.tell()
    uploaded.stream.seek(0)
    if size > MAX_UPLOAD_BYTES:
        raise ValueError("Image exceeds the 12 MB upload limit.")
    try:
        with Image.open(uploaded.stream) as image:
            image.verify()
            image_format = image.format
    except (UnidentifiedImageError, OSError, SyntaxError):
        raise ValueError("The uploaded file is not a valid supported image.") from None
    if image_format not in IMAGE_FORMATS:
        raise ValueError("Use a PNG, JPEG, WebP, or GIF image.")
    uploaded.stream.seek(0)
    original = Path(secure_filename(uploaded.filename)).stem
    base = slugify(original) or "image"
    upload_dir = draft_root / draft_id / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    draft = load_draft(draft_root, draft_id)
    slug = str((draft.get("data") or {}).get("slug") or "")
    media_dir = repo_root / "blog" / "media" / slug if slug else None
    filename = unique_filename(upload_dir, base, IMAGE_FORMATS[image_format], media_dir)
    uploaded.save(upload_dir / filename)
    return filename


def replace_staged_urls(value: str, draft_id: str, slug: str, filenames: list[str]) -> str:
    for filename in filenames:
        value = value.replace(
            f"/draft-media/{draft_id}/{filename}",
            f"/blog/media/{slug}/{filename}",
        )
    return value


def publish_article(app: Flask, draft_id: str, data: dict) -> dict:
    repo_root: Path = app.config["REPO_ROOT"]
    draft_root: Path = app.config["DRAFT_ROOT"]
    original_path = data.get("original_path", "")
    if original_path:
        target = safe_repo_path(repo_root, original_path)
        if not target.is_file():
            raise ValueError("The original article no longer exists.")
    else:
        target = repo_root / "blog" / "articles" / f"{data['slug']}.html"
        if target.exists():
            raise ValueError("That slug is already used by another article.")

    staged_dir = draft_root / draft_id / "uploads"
    staged_files = sorted(path for path in staged_dir.glob("*") if path.is_file())
    filenames = [path.name for path in staged_files]
    media_dir = repo_root / "blog" / "media" / data["slug"]
    for filename in filenames:
        if (media_dir / filename).exists():
            raise ValueError(f"An article image named {filename} already exists.")

    published_data = dict(data)
    published_data["content"] = replace_staged_urls(
        published_data["content"], draft_id, data["slug"], filenames
    )
    published_data["image"] = replace_staged_urls(
        published_data["image"], draft_id, data["slug"], filenames
    )
    body = sanitize_html(published_data["content"])
    if not body:
        raise ValueError("Article body is empty after sanitization.")
    document = article_document(published_data, body)

    with PUBLISH_LOCK:
        target.parent.mkdir(parents=True, exist_ok=True)
        previous = target.read_bytes() if target.exists() else None
        copied: list[Path] = []
        temporary = target.with_name(f".{target.name}.{uuid.uuid4().hex}.tmp")
        try:
            if staged_files:
                media_dir.mkdir(parents=True, exist_ok=True)
                for source in staged_files:
                    destination = media_dir / source.name
                    temp_image = destination.with_name(f".{destination.name}.tmp")
                    shutil.copy2(source, temp_image)
                    os.replace(temp_image, destination)
                    copied.append(destination)
            temporary.write_text(document, encoding="utf-8")
            os.replace(temporary, target)
            env = os.environ.copy()
            env["BUNDLE_USER_HOME"] = str(draft_root / ".bundle-home")
            completed = subprocess.run(
                app.config["BUILD_COMMAND"],
                cwd=repo_root,
                env=env,
                capture_output=True,
                text=True,
                timeout=120,
                check=False,
            )
            output = (completed.stdout + "\n" + completed.stderr).strip()
            if completed.returncode != 0:
                raise BuildFailed(output)
        except (BuildFailed, OSError, subprocess.TimeoutExpired) as exc:
            temporary.unlink(missing_ok=True)
            if previous is None:
                target.unlink(missing_ok=True)
            else:
                restore = target.with_name(f".{target.name}.restore")
                restore.write_bytes(previous)
                os.replace(restore, target)
            for path in copied:
                path.unlink(missing_ok=True)
            if media_dir.exists() and not any(media_dir.iterdir()):
                media_dir.rmdir()
            message = str(exc) or "Jekyll build timed out."
            return {
                "ok": False,
                "errors": ["Jekyll validation failed; repository files were restored."],
                "build_output": message,
            }

    shutil.rmtree(draft_root / draft_id, ignore_errors=True)
    relative = target.relative_to(repo_root).as_posix()
    return {
        "ok": True,
        "path": relative,
        "url": "/" + relative,
        "build_output": output,
    }


class BuildFailed(RuntimeError):
    pass
