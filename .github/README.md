# rsg.io

Personal site for `rsg.io`, authored as a small `mkpages` content tree and deployed with GitHub Pages.

## Local preview

Generate `.mkpages/` and render the finished HTML into `_site/`:

```bash
python .github/scripts/build_site.py --render
```

Serve the previously built output:

```bash
python -m http.server 4000 --directory _site
```

The site will be available at `http://127.0.0.1:4000`.

## Content layout

- `index.md` is the homepage.
- `about.md` and `captainslog.md` are top-level pages.
- `blog/` contains full-length posts.
- `projects/` contains project pages.
- `mkpages.yml` defines the site title, description, and navigation.
- `theme.css` overrides the bundled theme.

## Add a blog article

Create a new Markdown file in `blog/` with front matter similar to:

```yaml
---
title: "Post title"
date: 2026-08-16 09:00:00 -0700
permalink: /blog/post-slug/
project: envstack
tags:
  - python
excerpt: "One-sentence summary."
---
```

## Add to Captain's Log

Append a new newest-first entry to [captainslog.md](/mnt/homes/rsg/dev/rsg.io/captainslog.md):

```markdown
### Captain's log, Aug 16, 2026

shipped the thing

rsg
```

## Add or update a project

Projects live in `projects/` as Markdown files with front matter similar to:

```yaml
---
title: envstack
permalink: /projects/envstack/
description: "Layered environment configuration for Python and shell workflows."
status: active
site_url: "https://envstack.dev"
github_url: "https://github.com/rsgalloway/envstack"
tags:
  - python
---
```

## Deployment

GitHub Pages deployment runs automatically on push to `master` or `main` using `.github/workflows/pages.yml`.

## Dark Castle development

The repository-local theme uses `theme.css`, named layouts in `_layouts/`,
shared includes in `_includes/`, and original artwork and scripts under
`assets/darkcastle/`. `_data/castle.json` controls scene images, hotspot bounds,
and optional character paths. Coordinates are percentages of the scene image.

The log remains one authored file. The build wrapper generates five entries per
page at `/captainslog/` and `/captainslog/page/N/`. Do not hand-edit `.mkpages/`
or `_site/`. The wrapper also keeps private temporary/reference files out of
the public build. Rerun the build command after each edit.

See [design decisions](design/dark-castle.md). Run build validation with
`python -m unittest discover -s .github/scripts -p 'test_*.py'`.

This branch is for review: no commits until Ryan has reviewed. Later authorized
commits must have single-line messages and no attribution trailers.

Optional browser checks use `.github/scripts/test_browser.cjs`. With Playwright
installed in your tooling environment, serve the site and run:

```bash
node .github/scripts/test_browser.cjs
```

Set `CASTLE_BROWSER` to a system Chromium/Chrome executable if needed,
`CASTLE_PREVIEW_URL` to override port 4000, and `CASTLE_SCREENSHOT_DIR` to save
review screenshots. Playwright is test tooling only, not a site dependency.
