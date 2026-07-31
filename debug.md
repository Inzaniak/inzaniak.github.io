# Debug: About page number animation

## Observed symptom

The About page numbers do not animate smoothly from 0 to their final values (the requested 0-to-100% progression).

## Hypotheses

1. The count-up uses integer text updates, so a short duration or timing/rendering behavior may make the progression appear stepped rather than smooth.
2. The animation may be triggering at the wrong point or not updating the browser-rendered values consistently.
3. The current implementation may not express the desired 0-to-100% progress animation as a smooth visual transition.

## Verification plan

1. Inspect the current counter implementation and generated About page asset loading.
2. Check syntax/build output and identify whether the animation has a deterministic timing/rendering issue.
3. Replace the root cause with a browser-rendered smooth progress approach while preserving final values and reduced-motion behavior.
## Verification results

- The source and generated page load `js/about-numbers.js`.
- `node --check js/about-numbers.js` passes.
- `jekyll build --trace` passes.
- The prior counter implementation updated visible text with `Math.floor(...)`, so the browser could only display integer steps. The shortest counter (`6+`) had very few visible states, which explained the perceived jumpiness.

## Resolution

The root cause was integer-only rendering via `Math.floor(...)`; the shortest counter had too few visible states to look smooth. The counter now keeps every visible value as an integer using `Math.round(...)`, while the eased `requestAnimationFrame` timeline provides the smoothest possible transitions between whole-number states. It starts at zero before the section enters view, restores the exact target on the final frame, triggers once when any part of the numbers section enters the viewport, and gives reduced-motion users the final values immediately.

## Current bug verification

- The shared `.blog-entry.signal-row:hover` and `:focus-within` rule in `css/style.css` originally set `background: rgba(255, 51, 75, 0.08) !important`, which made the grid-backed `#fh5co-main` / `.fh5co-narrow-content` visible through hovered Blog and Stuff rows.
- The same selector is used by both `blog.html` entries and `stuff.html` entries, matching the reported scope.
- No temporary runtime diagnostic was needed: the computed style is explicit in the source and the selector path is deterministic.

## Current bug resolution

The translucent hover background was replaced with opaque `var(--surface-crimson-hover)` (`#241417`), preserving the original red highlight while preventing the page grid/background from showing through Blog and Stuff entries. `git diff --check` and `bundle exec jekyll build --trace` both pass.

## Debug: Last.fm link layout regression

### Verification results

- The missing closing `</div>` was restored after the Deezer card, making Deezer and Last.fm sibling columns in the Music Platforms row.
- `git diff --check` and `bundle exec jekyll build --trace` pass.
- Parsed generated markup confirms the Music Platforms row has 7 direct card columns in order: Bandcamp, Spotify, SoundCloud, Tidal, Apple Music, Deezer, and Last.fm.

### Resolution

The layout regression was caused by malformed HTML nesting from the original insertion, not by the Last.fm URL or CSS. The Last.fm card now has the same outer column structure as the other platform cards.

## Debug: About heading crop

### Observed symptom

On the About page, the final `o` in the large `Umberto` heading appears slightly cropped at its right edge. The expected result is that the complete glyph remains visible without changing the heading's intended visual scale or layout.

### Follow-up observation

After adding `padding-inline-end: 0.04em` to `.name-reveal`, the crop was reduced but remained visible. The initial allowance was therefore insufficient to clear the glyph's ink from the wrapper's clipping edge.

### Revised hypotheses

1. The heading's constrained `max-width` or the inline-grid name-reveal wrapper may clip the final glyph.
2. A line-height or overflow rule inherited by the heading/wrapper may clip font ink even when the layout box is wide enough.
3. The crop may be caused by a responsive grid boundary rather than the text itself.
4. Because `.name-reveal` clips animated vertical content, horizontal clipping may be the wrong mechanism; a directional overflow rule may preserve the animation while allowing the final glyph to render fully.

### Verification plan

1. Inspect the generated About markup and all relevant heading/name-reveal CSS, including responsive overrides.
2. Confirm whether the remaining crop is caused by horizontal clipping of the wrapper or by the heading/grid boundary.
3. Apply the smallest permanent fix, then run whitespace checks and a Jekyll build.
### Verification results

- The heading markup wraps `Umberto` in `.name-reveal`, and that wrapper now uses a directional `clip-path` to contain the animated default/alias text vertically without clipping the right edge.
- The hero heading uses `letter-spacing: -0.09em`; together with the inline-grid wrapper, the final glyph's right-side ink can extend beyond the clipping edge.
- The responsive rules change the hero grid columns but do not add another heading overflow rule, so the crop is local to `.name-reveal`.
- The first `padding-inline-end: 0.04em` adjustment reduced but did not eliminate the crop, confirming that padding alone was too fragile for the wrapper's four-sided overflow clip.
- `git diff --check` and `bundle exec jekyll build --trace` both pass after the directional clip fix.

### Resolution

Replaced the wrapper's four-sided `overflow: hidden` with `clip-path: inset(0 -0.15em 0 0)`. The top and bottom edges still contain the vertical name-reveal animation, while the negative right inset expands the horizontal paint area so the final glyph cannot be cut off.
