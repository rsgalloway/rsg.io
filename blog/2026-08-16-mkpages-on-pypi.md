---
layout: default
title: "mkpages is on PyPI"
date: 2026-08-16 11:30:00 -0700
permalink: /blog/mkpages-on-pypi/
project: mkpages
type: engineering
tags:
  - python
  - publishing
  - markdown
  - tooling
excerpt: "mkpages is now live on PyPI and powering this site from a plain markdown content tree."
---

`mkpages` is now live on PyPI, and `rsg.io` is using it as its publishing path.

The goal is intentionally small: keep the site as a normal tree of markdown files, add a little structure with `mkpages.yml`, and generate a static site that GitHub Pages can publish without any custom backend.

That means the content can stay close to the shape I actually want to edit:

- top-level pages like `index.md` and `about.md`
- a `blog/` directory for longer posts
- a `projects/` directory for project pages
- one config file for site metadata and navigation

The basic workflow is simple:

```bash
pip install mkpages
mkpages build .
mkpages serve
```

If I want to rebuild from scratch and then preview locally, the flow looks like this:

```bash
rm -rf .mkpages
mkpages build .
mkpages serve
```

For GitHub Pages, the repository workflow installs `mkpages`, runs `mkpages build .`, and then hands the generated `.mkpages` tree to the standard Pages/Jekyll build step.

That keeps the authoring side lightweight while still producing a static site that works well with Git as the source of truth.

I like this direction because it removes a lot of ceremony. Writing a post or adding a project page is just editing markdown, committing it, and letting the Pages build do the rest.
