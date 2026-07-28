from __future__ import annotations

import html
import re
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

import yaml


SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
ALLOWED_TAGS = {
    "a", "b", "blockquote", "br", "code", "del", "em", "figcaption",
    "figure", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "li",
    "ol", "p", "pre", "s", "strong", "table", "tbody", "td", "th",
    "thead", "tr", "u", "ul",
}
VOID_TAGS = {"br", "hr", "img"}
GLOBAL_ATTRS = {"class", "id", "title"}
TAG_ATTRS = {
    "a": {"href", "rel", "target"},
    "img": {"alt", "height", "loading", "src", "width"},
    "ol": {"start"},
    "td": {"colspan", "rowspan"},
    "th": {"colspan", "rowspan", "scope"},
}
URL_ATTRS = {"href", "src"}


def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def safe_web_url(value: str) -> bool:
    if value.startswith("/"):
        return not value.startswith("//")
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


class _Sanitizer(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.output: list[str] = []
        self.suppressed_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag in {"script", "style"}:
            self.suppressed_depth += 1
            return
        if self.suppressed_depth or tag not in ALLOWED_TAGS:
            return
        allowed = GLOBAL_ATTRS | TAG_ATTRS.get(tag, set())
        clean_attrs: dict[str, str] = {}
        for name, value in attrs:
            name = name.lower()
            value = value or ""
            if name not in allowed:
                continue
            if name in URL_ATTRS and not safe_web_url(value):
                continue
            if name == "target" and value not in {"_blank", "_self"}:
                continue
            clean_attrs[name] = value
        if tag == "img":
            clean_attrs.setdefault("alt", "")
            clean_attrs.setdefault("loading", "lazy")
        if tag == "a" and clean_attrs.get("target") == "_blank":
            rel = set(clean_attrs.get("rel", "").split())
            rel.update({"noopener", "noreferrer"})
            clean_attrs["rel"] = " ".join(sorted(rel))
        rendered = "".join(
            f' {name}="{html.escape(value, quote=True)}"'
            for name, value in clean_attrs.items()
        )
        self.output.append(f"<{tag}{rendered}>")

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in {"script", "style"}:
            self.suppressed_depth = max(0, self.suppressed_depth - 1)
            return
        if not self.suppressed_depth and tag in ALLOWED_TAGS and tag not in VOID_TAGS:
            self.output.append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        if not self.suppressed_depth:
            self.output.append(html.escape(data, quote=False))

    def handle_entityref(self, name: str) -> None:
        if not self.suppressed_depth:
            self.output.append(f"&{name};")

    def handle_charref(self, name: str) -> None:
        if not self.suppressed_depth:
            self.output.append(f"&#{name};")


def sanitize_html(value: str) -> str:
    parser = _Sanitizer()
    parser.feed(value)
    parser.close()
    return "".join(parser.output).strip()


def read_article(path: Path, repo_root: Path) -> dict:
    raw = path.read_text(encoding="utf-8")
    if not raw.startswith("---"):
        raise ValueError(f"{path} has no YAML front matter")
    _, front_raw, body = raw.split("---", 2)
    front = yaml.safe_load(front_raw) or {}
    date = front.get("date", "")
    categories = front.get("categories") or [
        item.strip() for item in str(front.get("kicker", "")).split("/") if item.strip()
    ]
    return {
        "original_path": path.relative_to(repo_root).as_posix(),
        "heading": str(front.get("heading") or front.get("title") or ""),
        "seo_title": str(front.get("title") or ""),
        "slug": path.stem,
        "date": date.isoformat() if hasattr(date, "isoformat") else str(date),
        "categories": categories,
        "deck": str(front.get("deck") or ""),
        "summary": str(front.get("summary") or front.get("deck") or ""),
        "description": str(front.get("description") or ""),
        "keywords": str(front.get("keywords") or ""),
        "image": str(front.get("image") or ""),
        "content": body.strip(),
    }


def article_document(data: dict, body: str) -> str:
    heading = data["heading"].strip()
    front = {
        "layout": "article",
        "title": data.get("seo_title", "").strip() or f"Inzaniak - {heading}",
        "heading": heading,
        "kicker": " / ".join(data["categories"]),
        "deck": data["deck"].strip(),
        "description": data["description"].strip(),
        "keywords": data.get("keywords", "").strip(),
        "active": "blog",
        "date": data["date"],
        "categories": data["categories"],
        "summary": data["summary"].strip(),
        "image": data["image"].strip(),
    }
    front_raw = yaml.safe_dump(
        front, allow_unicode=True, default_flow_style=False, sort_keys=False
    ).strip()
    return f"---\n{front_raw}\n---\n\n{body}\n"


def validate_article(data: dict) -> list[str]:
    errors: list[str] = []
    required = {
        "heading": "Headline",
        "slug": "Slug",
        "date": "Publication date",
        "deck": "Deck",
        "summary": "Card summary",
        "description": "Description",
        "image": "Cover image",
        "content": "Article body",
    }
    for key, label in required.items():
        if not str(data.get(key, "")).strip():
            errors.append(f"{label} is required.")
    slug = str(data.get("slug", ""))
    if slug and not SLUG_RE.fullmatch(slug):
        errors.append("Slug may contain lowercase letters, numbers, and single hyphens.")
    try:
        date.fromisoformat(str(data.get("date", "")))
    except ValueError:
        errors.append("Publication date must be a valid date.")
    categories = data.get("categories")
    if not isinstance(categories, list) or not any(str(item).strip() for item in categories):
        errors.append("At least one category is required.")
    image = str(data.get("image", ""))
    if image and not safe_web_url(image) and not image.startswith("/draft-media/"):
        errors.append("Cover image must be an uploaded image or an http(s)/site-relative URL.")
    return errors
