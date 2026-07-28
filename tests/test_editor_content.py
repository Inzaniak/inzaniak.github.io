from pathlib import Path

from blog_editor.content import (
    article_document,
    read_article,
    sanitize_html,
    slugify,
    validate_article,
)


def valid_article():
    return {
        "heading": "A useful guide",
        "seo_title": "",
        "slug": "a-useful-guide",
        "date": "2026-07-28",
        "categories": ["GENAI", "Workflow"],
        "deck": "The short deck.",
        "summary": "The listing summary.",
        "description": "A search description.",
        "keywords": "guide, workflow",
        "image": "/blog/media/a-useful-guide/cover.jpg",
        "content": "<h2>Start</h2><p>Hello.</p>",
    }


def test_slugify_and_validation():
    assert slugify("  My First Article! ") == "my-first-article"
    assert validate_article(valid_article()) == []
    broken = valid_article()
    broken.update(slug="../bad", date="not-a-date", categories=[])
    errors = validate_article(broken)
    assert any("Slug" in error for error in errors)
    assert any("date" in error for error in errors)
    assert any("category" in error for error in errors)


def test_sanitizer_preserves_article_markup_and_blocks_scripts():
    raw = (
        '<h2 id="Intro">Intro</h2><script>alert(1)</script>'
        '<p onclick="bad()">Read <a href="https://example.com" target="_blank">this</a>.'
        '<img src="/blog/media/pic.jpg" onerror="bad()"></p>'
        '<a href="javascript:alert(1)">bad</a>'
    )
    clean = sanitize_html(raw)
    assert '<h2 id="Intro">' in clean
    assert "script" not in clean
    assert "onclick" not in clean
    assert "onerror" not in clean
    assert 'loading="lazy"' in clean
    assert 'rel="noopener noreferrer"' in clean
    assert "javascript:" not in clean


def test_article_front_matter_round_trip(tmp_path: Path):
    data = valid_article()
    document = article_document(data, data["content"])
    path = tmp_path / "blog" / "articles" / "a-useful-guide.html"
    path.parent.mkdir(parents=True)
    path.write_text(document, encoding="utf-8")
    loaded = read_article(path, tmp_path)
    assert loaded["heading"] == data["heading"]
    assert loaded["categories"] == data["categories"]
    assert loaded["date"] == data["date"]
    assert loaded["content"] == data["content"]
