import io
import sys
import uuid
from pathlib import Path

from PIL import Image

from blog_editor.app import create_app


def make_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    (repo / "blog" / "articles").mkdir(parents=True)
    return repo


def make_app(tmp_path: Path, build_success: bool = True):
    repo = make_repo(tmp_path)
    command = [
        sys.executable,
        "-c",
        "print('build passed')" if build_success else "import sys; print('broken'); sys.exit(1)",
    ]
    app = create_app(
        {
            "TESTING": True,
            "SECRET_KEY": "test-secret",
            "REPO_ROOT": repo,
            "DRAFT_ROOT": tmp_path / "drafts",
            "BUILD_COMMAND": command,
        }
    )
    return app, repo


def csrf(client):
    client.get("/")
    with client.session_transaction() as session:
        return session["csrf_token"]


def article_payload():
    return {
        "original_path": "",
        "heading": "My test article",
        "seo_title": "",
        "slug": "my-test-article",
        "date": "2026-07-28",
        "categories": ["GENAI", "Testing"],
        "deck": "A deck for the article.",
        "summary": "A summary for the listing.",
        "description": "A useful test article.",
        "keywords": "test, article",
        "image": "https://example.com/cover.jpg",
        "content": "<h2>Introduction</h2><p>Hello <strong>world</strong>.</p>",
    }


def test_dashboard_and_csrf(tmp_path):
    app, _repo = make_app(tmp_path)
    client = app.test_client()
    assert client.get("/").status_code == 200
    assert client.get("/articles/new").status_code == 200
    response = client.post("/api/drafts", json={"data": article_payload()})
    assert response.status_code == 400


def test_existing_article_opens_in_editor(tmp_path):
    app, repo = make_app(tmp_path)
    article = repo / "blog" / "articles" / "existing.html"
    article.write_text(
        """---
layout: article
title: Inzaniak - Existing
heading: Existing
kicker: GENAI / Guide
deck: Existing deck
description: Existing description
active: blog
date: 2025-01-02
categories: [GENAI, Guide]
summary: Existing summary
image: /blog/media/existing.jpg
---

<h2>Existing body</h2>
""",
        encoding="utf-8",
    )
    client = app.test_client()
    response = client.get("/articles/edit?path=blog/articles/existing.html")
    assert response.status_code == 200
    assert b"Existing body" in response.data
    assert b"readonly" in response.data


def test_autosave_upload_and_publish(tmp_path):
    app, repo = make_app(tmp_path)
    client = app.test_client()
    token = csrf(client)
    headers = {"X-CSRF-Token": token}
    data = article_payload()
    saved = client.post("/api/drafts", json={"data": data}, headers=headers)
    assert saved.status_code == 200
    draft_id = saved.get_json()["draft_id"]

    image_bytes = io.BytesIO()
    Image.new("RGB", (8, 8), "red").save(image_bytes, format="PNG")
    image_bytes.seek(0)
    uploaded = client.post(
        "/api/uploads",
        data={"draft_id": draft_id, "file": (image_bytes, "Cover Image.png")},
        headers=headers,
        content_type="multipart/form-data",
    )
    assert uploaded.status_code == 200
    upload_url = uploaded.get_json()["url"]
    data["image"] = upload_url
    data["content"] += f'<p><img src="{upload_url}" alt="Cover"></p>'

    response = client.post(
        "/api/publish",
        json={"draft_id": draft_id, "data": data},
        headers=headers,
    )
    assert response.status_code == 200
    article = repo / "blog" / "articles" / "my-test-article.html"
    media = repo / "blog" / "media" / "my-test-article" / "cover-image.png"
    assert article.is_file()
    assert media.is_file()
    content = article.read_text(encoding="utf-8")
    assert "/blog/media/my-test-article/cover-image.png" in content
    assert not (tmp_path / "drafts" / draft_id).exists()


def test_failed_build_restores_existing_article(tmp_path):
    app, repo = make_app(tmp_path, build_success=False)
    path = repo / "blog" / "articles" / "existing.html"
    original = "---\nlayout: article\n---\n\n<p>Original</p>\n"
    path.write_text(original, encoding="utf-8")
    client = app.test_client()
    token = csrf(client)
    data = article_payload()
    data.update(
        original_path="blog/articles/existing.html",
        slug="existing",
        content="<p>Replacement</p>",
    )
    draft_id = str(uuid.uuid4())
    response = client.post(
        "/api/publish",
        json={"draft_id": draft_id, "data": data},
        headers={"X-CSRF-Token": token},
    )
    assert response.status_code == 422
    assert "restored" in response.get_json()["errors"][0]
    assert path.read_text(encoding="utf-8") == original
    assert (tmp_path / "drafts" / draft_id / "draft.json").is_file()


def test_rejects_duplicate_slug_and_invalid_image(tmp_path):
    app, repo = make_app(tmp_path)
    (repo / "blog" / "articles" / "my-test-article.html").write_text("existing", encoding="utf-8")
    client = app.test_client()
    token = csrf(client)
    headers = {"X-CSRF-Token": token}
    draft_id = str(uuid.uuid4())
    client.post(
        "/api/drafts",
        json={"draft_id": draft_id, "data": article_payload()},
        headers=headers,
    )
    bad_upload = client.post(
        "/api/uploads",
        data={"draft_id": draft_id, "file": (io.BytesIO(b"not an image"), "bad.png")},
        headers=headers,
        content_type="multipart/form-data",
    )
    assert bad_upload.status_code == 400
    duplicate = client.post(
        "/api/publish",
        json={"draft_id": draft_id, "data": article_payload()},
        headers=headers,
    )
    assert duplicate.status_code == 400
    assert "already used" in duplicate.get_json()["errors"][0]
