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
| `css/about-grid.css` | Layout specific to the About page |
| `js/` | `main.js` (nav + hero slider), `dither-engine.js` (hero canvas), `about-progress.js` |
| `catalog/`, `images/`, `media/`, `music/` | Image assets |
| `blog/` | Published article exports |

Top-level `*.html` files are page content only — the chrome comes from `_layouts/default.html`.

## Adding content

**A model to the catalog** — one entry in `_data/catalog.yml`:

```yaml
- { name: Wasabi, type: LORA, image: catalog/wasabi_xl.webp, url: https://civitai.com/models/... }
```

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
all current styling are custom. Third-party code still in use: jQuery, jQuery Easing, jQuery
Waypoints, FlexSlider, Font Awesome (CDN kit), and Google Fonts (Inter, JetBrains Mono).
