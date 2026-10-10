# Dark Castle Personal Website — Technical Plan

Status: Initial implementation specification (2026-10-09)

## Vision
A full-screen, interactive, monochrome personal website inspired by the atmosphere of the 1986 Macintosh game *Dark Castle*. The site is a static website first: exploration enhances navigation but never gates content. The landing page features a compact, nearly black castle silhouetted against a large moon, a tiny adventurer, layered mist, lake cliffs, distant mountains, foreground trees, and fine 1-bit illustration.

## Non-negotiable requirements
- Preserve existing public article and Captain's Log URLs; audit routes before any migration, use redirects only when necessary.
- Every content page and room can be loaded directly without first entering the castle.
- Maintain Markdown + front matter authoring via the existing mkpages/Jekyll pipeline.
- All required content is accessible without Canvas or JavaScript; HTML navigation is semantic and keyboard accessible.
- Full-screen castle presentation, no default Macintosh window frame; detailed black-and-white scene art at native resolution.
- No floating labels in the Great Hall. Use subtle hover/focus affordances and accessible names.
- Clicking a hotspot triggers a brief optional character movement and interaction animation; it must never require platforming or precise controls.
- Respect prefers-reduced-motion; provide skip and immediate navigation behavior.
- Use original artwork/sounds evocative of the era, not copied game assets or logo artwork.

## MVP scope
1. Exterior scene at `/` with a looming tower, moon, small protagonist, and compact welcome prompt; the entire scene enters the castle.
2. Great Hall at `/castle/hall/` with architectural hotspots and a journal on a lectern.
3. Captain's Log index at its existing canonical URL; journal hotspot animates character approach/open, then navigates there.
4. One existing Captain's Log entry rendered from Markdown and reachable by its original URL.
5. Browser back/forward and reload work on all routes.

Out of scope for MVP: Finder simulation, sound, keyboard platforming, additional explorable rooms, accounts, backend services, complex pathfinding.

## Architecture

```text
Markdown + front matter
        |
    mkpages / Jekyll build
        |----------------------------|
        v                            v
 Static HTML pages             Generated site index (JSON)
        |                            |
        |                      Scene / hotspot manifests
        |                            |
        +---------- Static host -----+
                        |
                  Browser client
               HTML content + Canvas
```

- Keep the content pipeline unchanged initially. Use Jekyll layouts/includes and optional generated JSON for scene metadata and latest posts.
- Build the castle as a small standalone TypeScript/JavaScript module; no full game engine unless a prototype demonstrates a need.
- Use HTML links for each hotspot, layered over or adjacent to Canvas as appropriate. Canvas draws scenes and animations, while the DOM provides semantic navigation and fallback.
- Prefer regular document navigation to content pages for robust deep links; the scene animation can delay navigation briefly, with a timeout/skip path.
- The scene module reads a declarative manifest: background assets, logical dimensions, spawn point, hotspot geometry, destination URL, approach point, and animation sequence.
- No server-side runtime is required; deploy the generated static output to existing hosting.

## Suggested source layout

```text
assets/darkcastle/
  scenes/exterior.png
  scenes/hall.png
  sprites/hero.png
  scripts/engine.ts
  styles/castle.css
  manifests/exterior.json
  manifests/hall.json
_layouts/castle.html
_layouts/default.html
_posts/...
```

Adapt paths to actual mkpages/Jekyll conventions after inspecting the repository; do not assume the above tree already exists.

## Scene manifest sketch

```json
{
  "id": "hall",
  "logicalSize": [512, 342],
  "background": "/assets/darkcastle/scenes/hall.png",
  "character": {"spawn": [90, 240]},
  "hotspots": [
    {
      "id": "captains-log",
      "label": "Captain's Log",
      "bounds": [280, 150, 70, 65],
      "approach": [270, 225],
      "action": "open-book",
      "href": "<existing-canonical-captains-log-url>"
    }
  ]
}
```

The coordinates and URLs above are illustrative placeholders, not final assets or route decisions.

## Rendering and responsive behavior
- Prototype at a 512×342 logical scene resolution to echo the original Macintosh display; evaluate actual sprite readability before locking it.
- Use `image-rendering: pixelated` and integer scaling where feasible; on widescreen displays, compose or extend backgrounds rather than stretch them non-uniformly.
- Keep UI text in accessible HTML rather than baking critical navigation text into bitmap art.
- Provide an alternate simple HTML index on small screens and where pointer precision is limited, while preserving the castle visually when practical.
- Limit animation work while tab is hidden; avoid large continuous effects.

## Interaction sequence
1. Exterior loads as a static image immediately, with progressive enhancement once scripts initialize.
2. Clicking the entrance triggers character approach, door-open frames, then navigates to `/castle/hall/`.
3. Clicking the journal in the hall triggers approach, book-open frames, then navigates to the Captain's Log index.
4. Directly opening the Captain's Log URL renders readable content immediately with no animation.
5. Browser history, refresh, keyboard focus, and reduced-motion paths are tested.

## Later phase: Quit Game / Finder
- Hidden `⌘Q` (and equivalent non-Mac shortcut or discoverable menu) exits the castle to a simulated monochrome Finder.
- Finder is an alternate static-content browser; it does not replace canonical page URLs.
- Relaunching Dark Castle returns to the last visited room (client-side state, with sensible fallback).
- Keep Finder implementation outside MVP but reserve a top-level presentation-mode boundary in the frontend architecture.

## Acceptance criteria
- `mkpages`/Jekyll build produces a fully static deployable site.
- Existing content URLs resolve unchanged, including direct loads and browser back/forward.
- Exterior and hall render sharply in black and white with no required game controls.
- Entrance and journal hotspots work with mouse, touch, keyboard, and screen readers.
- Reduced-motion users reach destinations immediately or with minimal effects.
- Content remains reachable when JavaScript is disabled.
- No third-party copyrighted game assets are bundled.

## First Codex work order
1. Inspect current repository, mkpages invocation, Jekyll layouts, and existing URL structure; report compatibility constraints before modifying routes.
2. Scaffold a small standalone castle scene component and declarative manifest loader.
3. Build an exterior-to-hall navigation spike using placeholder original 1-bit assets, then connect a journal hotspot to the existing Captain's Log index.
4. Validate static build, deep links, no-JS fallback, keyboard navigation, and reduced motion.
5. Keep art replacement separate from interaction logic so final hand-authored sprites can be swapped in later.

## Open design decisions
- Exact original-art production workflow and sprite-sheet dimensions.
- Whether later exterior iterations need hand-authored mist or additional depth planes.
- How the hall visually indicates hotspots without floating labels.
- Whether articles use a restrained themed layout or a more elaborate manuscript motif.


## Implementation decisions — October 9, 2026

- Work on `dark-castle-redesign`. No commits until Ryan has reviewed. Any later
  authorized commits use a single-line message and no attribution trailers.
- Keep mkpages and Jekyll. Dark Castle is a repository-local design, not a new
  bundled mkpages theme. `theme.css`, `_layouts/castle.html`,
  `_layouts/article.html`, `_includes/castle-head.html`, `_data/castle.json`, and
  `assets/darkcastle/` are the sources; `.mkpages/` and `_site/` are generated.
- mkpages copies custom layouts, but regenerates `default.html`. Use named
  custom layouts and select them in front matter; no mkpages update required.
- Captain’s Log stays authored in `captainslog.md`. A local build wrapper splits
  entries at level-three headings into five entries per static page. The latest
  entries remain at `/captainslog/`; older pages use `/captainslog/page/N/`.
  Entries do not get individual page URLs. Page numbers shift as entries are added.
- Retain all article, project, about, and index permalinks. Add `/castle/hall/`.
- Use full-screen artwork for exterior and hall; no desktop window frames.
  Use a restrained light reading surface for content pages. Existing content
  and project metadata remain intact. The original home introduction and project
  cards remain accessible as `/castle/directory/`.
- Artwork is original generated monochrome scene art. Navigation labels and
  titles are HTML. Hotspots are real links rendered from the same manifest that
  supplies optional character movement. No Canvas or JavaScript is required.
- Use an ordinary static image and DOM sprite rather than Canvas for the MVP;
  there is no continuous render loop. Motion is short, skippable, and disabled
  for reduced-motion preferences. The map is a native HTML details element.
- Stage only public source files before mkpages runs, keeping reference images,
  local temporary files, build scripts, and design documents out of the site.
- Publish remains the existing GitHub Pages workflow. No deployment is requested
  as part of this local implementation/review.

## Local build and review

Run `python .github/scripts/build_site.py --render`. This runs Jekyll from
inside `.mkpages/`, avoiding a layout path issue in local Jekyll 3.8.
Serve `_site` with `python -m http.server 4000 --directory _site`.
Rerun the build after editing; plain `mkpages build .` does not paginate
Captain’s Log or exclude local reference files.

Artwork can be swapped by updating the image paths and hotspot coordinates in
`_data/castle.json`; scene logic does not depend on a particular illustration.

The build pins mkpages 0.4.1, the inspected local version, for reproducibility.
The balcony doors navigate immediately because the illustrated hall has no
continuous path from the foreground floor to the balcony. Lower-floor doors
and the journal have brief approach animations.

## MVP verification

- Static build: 32 pages, including the exterior, hall, preserved home directory,
  and three Captain’s Log pages containing all 11 entries exactly once.
- Python regression suite checks existing public permalinks, all generated local
  links/assets/fragments, pagination boundaries, and fenced-code handling.
- Chromium checks cover entrance/journal navigation, keyboard activation, history
  and reload, reduced motion, JavaScript disabled, and mobile overflow.
- Desktop and mobile screenshots inspected during implementation.
- Original generated scene PNGs and authored SVG character poses are separate
  from navigation logic. This is an initial art/interaction pass for review.

## Fullscreen presentation follow-up

- The interactive exterior and Great Hall occupy the full viewport without a
  header, caption, or footer. Reading pages retain their reading navigation.
- The castle map remains as a compact overlay so every destination is still
  available without JavaScript or pointer-only interaction.
- The exterior adds slow stippled cloud drift and stepped moonlight breathing.
  Both are decorative, CSS-only, and become static or disappear under
  `prefers-reduced-motion`.
- The exterior keeps only the Dark Castle title, ornament, and enter prompt;
  the introductory eyebrow and engineering tagline were removed.

## Exterior art and motion follow-up

- The exterior now uses a smaller, blockier original fortress rendered with
  coarse 1-bit pixels. The previous detailed Gothic scene remains in the
  repository for comparison while the manifest points to `exterior-v2.png`.
- Clouds are a separate outlined-and-dithered SVG layer crossing both black sky
  and white moon. Moon glow, a distant lightning bolt, and the lightning flash
  are independent CSS layers with distinct timing.
- The title uses Almendra SC on one line so the K remains legible. The character
  sprites use a 28×40 logical grid with hair, face, shirt, belt, separated
  legs, and a distinct reaching pose. The exterior spawn sits clear of the enter prompt.
- Reduced-motion mode hides cloud and lightning layers and keeps only a static
  moon glow.

## Lake landscape follow-up

- The exterior manifest now points to `exterior-v3.png`: a predominantly black
  fortress rising from lake cliffs, with moon reflections, distant mountain
  layers, foreground tree and rock silhouettes, and static stippled mist.
- The independent cloud SVG was redrawn as a long, thin mist ribbon and slowed
  to 34- and 49-second crossings. It remains separate from the atmospheric mist
  baked into the scene, so the sky has both depth and visible motion.
- The exterior spawn and approach path follow the new right-hand cliff path to
  the illuminated entrance.

## Layered exterior follow-up

- This revision supersedes the earlier title-font and moving cloud-strip notes.
- The exterior uses `exterior-v4.png`, rendered at 1536x1024 with fine stipple
  and line work. Browser scaling uses normal image interpolation instead of
  forcing enlarged nearest-neighbor pixels.
- The title and bottom enter prompt were replaced with a small HTML
  "Welcome. Click to enter the castle." message. A full-scene anchor makes any
  click or tap enter the Great Hall while retaining keyboard and no-JavaScript
  navigation.
- Mist is a transparent `mist-v2.png` plane over the landscape. Background and
  mist respond to pointer position at shallow, different depths with damped
  motion of only a few pixels; there is no autonomous cloud drift.
- Touch devices keep the layers static. `prefers-reduced-motion` also removes
  parallax and retains immediate navigation.

## Full-bleed exterior follow-up

- The reviewed layered exterior was checkpointed in commit `aab550d`.
- The exterior again covers the entire viewport. It is anchored to the top on
  wide screens so every castle tower remains visible; excess lake and foreground
  may crop below the viewport instead of adding side bars.
- The exterior uses `exterior-v6.png`. Its small-grain stipple and detailed line
  texture intentionally match the original Great Hall while avoiding enlarged
  square pixels. The Great Hall artwork remains unchanged.
- Player sprites and travel animations are removed from all scenes for now.
  Hotspots remain ordinary semantic links with immediate navigation.
- The welcome copy is removed. The exterior restores a centered
  "Click to enter" prompt positioned from the viewport edge so it remains visible
  even when the lower part of the cover-sized artwork is cropped.


## Independent scene layers (current revision)

The reviewed v6 exterior was checkpointed in `92bd543`. The subsequent cropped
water and inverted lightning experiments were rejected and are superseded by
this composition. The misplaced moon glow and lightning bolt are removed.

Eight separate planes, from back to front:

1. Black sky with sparse stars and subtle, slow opacity twinkling.
2. Static moon, matching the supplied crop's broad flat stippled patches.
3. Thin ground mist behind the mountain ridges, drifting left to right over
   four- and five-minute cycles with very small travel distances.
4. Static background mountains and trees.
5. Static cliffs and castle.
6. Independent lake plate with subtle three-state ripple/reflection motion.
7. Static foreground land and tree.
8. Viewport-positioned “Click to enter” prompt inside the full-scene link.

The six raster assets in `assets/darkcastle/layers/` were generated separately
with built-in imagegen. They reconstruct v6's composition; they are not exact
extractions. Transparent assets retain opaque black shadows inside their
silhouettes. The sky is authored SVG and the prompt is HTML. Generation prompts
and revision notes are recorded in [the prompt set](dark-castle-layers/prompts.json).
The Great Hall keeps its original artwork and stippling.

Water frames are generated once in the browser from the water-only plate by
varying small horizontal scanline offsets, then switched every two seconds.
No cliffs, banks, or foreground pixels are in the animated plate. These are
procedural ripple states, not separately illustrated lighting or wave frames.
JavaScript disabled or reduced-motion mode retains the static water image;
reduced-motion also stops stars and mist. Hidden tabs pause all motion.

Lightning was deferred during layer review; the directional lightning draft
below now adds lighting states to layers 4–6. No pointer parallax
is applied to the layers marked static. Portrait screens crop toward the castle
side, reposition the moon behind it, and keep the enter prompt viewport-centered.

For local inspection, run `python .github/scripts/preview_castle_layers.py`
after building and visit `/layer-review/` on the preview server. This local-only
page can toggle or isolate each layer, show a transparency grid, and pause
motion. It is not emitted by the production build.

## Continuous background mist (current revision)

The eight-layer revision was reviewed and checkpointed in `cdfce88`.
Only the cloud bank changes in this follow-up. The annotated v6 reference calls
for high sides and a low central valley, with fine diagonal engraving that fades
upward into sparse stipple. `clouds-hatched.png` is the selected texture; the
coarse speckled bank and dark geometric stripes were rejected.

The half-scale detail, slow drift, and left-side height were approved. Trying to
raise the sides using another copy at a different height created a disconnected
central overlap. That two-bank implementation is removed.

`.github/scripts/render_clouds.cjs` exports the approved continuous contour to
`assets/darkcastle/layers/clouds-continuous.png`. The authoring tool renders the
fine source texture at roughly half scale, normalizes its upper edge, and maps
it onto one smooth periodic contour: about y=155 at the sides and y=355 centrally
in the 1536×1024 scene. The second half of the exported image repeats the first
pixel-for-pixel. Regenerate only when artwork or contour changes, using Node with
Playwright and `CASTLE_BROWSER` pointing to Chromium; the site build needs neither.

The page loads that finished image directly. The previous runtime source-image to
canvas swap caused a visible load pop and is removed. JavaScript-enabled and
no-JavaScript visitors see exactly the same cloud asset. CSS moves it to the right
by one bank width every 45.45 minutes (about 0.56 scene pixels per second), a 10% speed increase
from the reviewed 50-minute loop. The former
120-minute loop moved only 0.21 pixels per second and was difficult to notice.
Reduced-motion mode holds it still; hidden tabs and the review pause control stop
motion. All other layers remain unchanged.

Browser checks inspect the rendered alpha contour for gaps and abrupt height
changes, compare the repeated halves, measure actual drift, and exercise the loop,
reduced motion, no-JavaScript navigation, and a delayed first image load to verify
that the cloud element and source never swap during startup.

## Directional lightning draft

Lightning is now implemented for four layers: background
mountains/trees (4), castle/cliffs (5), lake (6), and foreground tree/shore (7). Separate imagegen lighting
edits in `assets/darkcastle/layers/lightning/` illuminate left-facing surfaces and
water crests from an off-screen source at screen left. Right-facing surfaces stay
dark. There is no image inversion, lightning-bolt graphic, or whole-screen wash.
The [lighting prompts](dark-castle-layers/lightning-prompts.json) record each edit.

The original image bounds and CSS transforms are shared with each lit variant.
Castle, mountain, and foreground variants are constrained by their original alpha silhouettes
to prevent generated edge halos spilling into other layers. The relighting is
illustrative rather than a deterministic 3D render; internal stone/tree texture
may vary slightly, so the held lighting view is part of the art review.

After all four light images decode, the first automatic flash arrives after six
seconds, then at intervals of 14–24 seconds. One shared exposure state gives a
180 ms bright phase, then a 200 ms dim phase, then returns to night. The dim phase
uses the same directional artwork at lower opacity; it is not a second generated
lighting frame. Reduced motion disables animated flashes, and hidden/paused pages
cancel active flashes and pending timers. No-JavaScript views remain in night light.

The local layer inspector has Night and Light from left held states plus a Preview
flash button. These allow comparison of each isolated layer and the full composite
without waiting for a storm. Sky, moon, clouds, and UI do not flash.
Browser checks cover registration, simultaneous exposure, restoration, asset-load
readiness, automatic timing, reduced motion, and no-JavaScript behavior.

The foreground lighting pass adds narrow left-facing highlights on bark, rocks,
branches, and grasses, while substantially darkening right-facing surfaces and
the right shore. It shares the same flash timing and original silhouette mask.
The night foreground remains unchanged; the stronger shadows belong to the
directional flash state. Review layer 7 in isolation or with the complete scene.

## Library reading-window draft

The Library establishes the room treatment for the Observatory and Workshop.
A static, full-viewport illustration matches the Great Hall's fine monochrome
stippling and stone architecture. Shelves, a ladder, and a moonlit window frame
the reading area. The generated asset and prompt are recorded in
[room prompts](dark-castle-rooms/prompts.json).

The writing index and its articles use an opaque white document window with a
striped title bar, double border, square corners, and a hard black shadow. The
close-box link returns to the Great Hall; article breadcrumbs return to the
Library. These are ordinary links, with no decorative nonfunctional controls.
The page scrolls normally over a stationary room; no nested reading scrollbar
or JavaScript is required. On mobile the panel nearly fills the width and leaves
a strip of room artwork above it. All content and existing URLs are retained.
The Workshop and other reading pages retain their previous layout. The Great Hall artwork, exterior animation, and audio are unchanged.

## Observatory reading-window draft

The About page at `/about/` now uses the shared Mac-style reading window over
a static Observatory illustration. It matches the Hall's fine stippling, with
a telescope at the left opening and an armillary sphere and astronomical chart
at the right. The About text and external links remain intact. The title bar
names the Observatory, and its close link returns to the Great Hall.

`_data/reading_rooms.json` holds each illustrated room's title and artwork path;
the article layout chooses the Library for writing and Observatory for About.
Both use the same window markup, document scrolling, and responsive styling.
