# inzaniak.github.io

Personal site for Umberto Grando (Inzaniak) — music, media, AI/Stable Diffusion models, and
writing. Static site served by GitHub Pages from `master` at
<https://inzaniak.github.io>.

## Stack

Plain HTML/CSS/JS built by Jekyll (GitHub Pages' default). There is no npm, no bundler, and
no CI step — pushing to `master` deploys.

## Layout

| Path | What lives there |
|---|---|
| `_layouts/`, `_includes/` | The shared page shell: `<head>`, sidebar nav, footer, icon sprite |
| `_data/nav.yml` | The navigation menu — add a page here, not in 8 HTML files |
| `_data/social.yml` | Footer social links |
| `_data/catalog.yml` | The Stable Diffusion model catalog rendered by `catalog.html` |
| `css/style.css` | The "Charcoal & Crimson Dither" design system, including `:root` design tokens |
| `css/about-grid.css` | Layout specific to the About page (loaded only by `about.html`) |
| `css/flexslider.css` | FlexSlider theme (loaded only by `index.html`, the one page with a slider) |
| `js/` | `main.js` (nav + card animations + hero slider), `dither-engine.js` (hero/card canvas), `about-progress.js` |
| `catalog/`, `images/`, `media/`, `music/` | Image assets |
| `blog/` | Articles (`_layouts/article.html`), with images in `blog/media/` and `blog/compressed/` |

Top-level `*.html` files are page content only — the chrome comes from `_layouts/default.html`.

Per-page assets go in front matter rather than the shared `<head>`, so a page only
pays for what it uses:

```yaml
extra_css: [/css/about-grid.css]
extra_js: [/js/dither-engine.js]
```

## Adding content

**A model to the catalog** — one entry in `_data/catalog.yml`:

```yaml
- { name: Wasabi, type: LORA, image: catalog/wasabi_xl.webp, url: https://civitai.com/models/... }
```

**An article** — create `blog/articles/foo.html` with `layout: article` and plain HTML
below the front matter. Articles with listing metadata are added to `blog.html`
automatically:

```yaml
---
layout: article
title: "Inzaniak - Foo"
heading: "Foo"
kicker: "GENAI / Stable Diffusion / Workflow"
deck: "One line under the headline."
description: What this article is about.
active: blog
date: 2026-07-28
categories: [GENAI, Stable Diffusion, Workflow]
summary: A short line for the blog listing.
image: /blog/media/foo/cover.jpg
---
```

### Local blog editor

The repository includes a local Flask writing app with rich-text and HTML editing,
live preview, autosaved drafts, image uploads, and Jekyll validation. It listens only
on your computer and is excluded from the published site.

Set it up once:

```bash
python3 -m venv .venv-editor
.venv-editor/bin/pip install -r requirements-editor.txt
```

Launch it from the repository root:

```bash
.venv-editor/bin/python -m blog_editor
```

Then open <http://127.0.0.1:5050>. Drafts and temporary images live in the
gitignored `.blog-editor/` directory. Publishing creates or updates the article,
moves its uploaded images into `blog/media/<slug>/`, and runs a full Jekyll build.
If that build fails, the editor restores the previous repository files and shows
the build output. Publishing intentionally does not commit or push; review the
result and use your normal Git workflow to deploy it.

**A page** — create `foo.html` with front matter, then add it to `_data/nav.yml`:

```yaml
---
layout: default
title: Inzaniak - Foo
description: What this page is about.
active: foo
---
```

## Running locally

Needs Ruby 2.7+ (the macOS system Ruby 2.6 is too old):

```bash
brew install ruby            # if you don't have a modern Ruby
bundle install
bundle exec jekyll serve      # http://127.0.0.1:4000
```

## Credits

Originally derived from the "Marble" template by freehtml5.co; the layout, design system, and
all current styling are custom. Third-party code still in use: jQuery, jQuery Waypoints,
FlexSlider (`index.html` only), Font Awesome (CDN kit), and Google Fonts (Inter, JetBrains Mono).
