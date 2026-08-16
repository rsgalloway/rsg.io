# rsg.io

Personal site for `rsg.io`, authored as a small `mkpages` content tree and deployed with GitHub Pages.

## Local preview

Build the site into `.mkpages`:

```bash
mkpages build .
```

Serve the previously built output:

```bash
mkpages serve
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
