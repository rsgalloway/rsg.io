---
layout: default
title: Captain's Log
permalink: /captainslog/
---

## Captain's Log

Newest-first notes on shipped work, releases, and smaller milestones that do not need a full article.

### Captain’s log, Sep 18, 2026

Subfork moved into real account/auth setup: wired up GitHub OAuth for Subfork and started configuring Google sign-in, shifting the project from mostly product/graph architecture into the less glamorous but very real work of making it usable by outside people.

### Captain’s log, Sep 14, 2026

Subfork started as an experiment in “forkable” websites. Now the underlying idea is becoming explicit: expose the DAG beneath those sites as a first-class, granular programming model, where nodes can be composed, connected, forked, and executed independently. The website is becoming just one possible output of the graph.

### Captain’s log, Sep 10, 2026

pushing Subfork toward beta with a clearer model: fork-to-run graphs, authenticated API execution, BYO API keys, agent/MCP access, and a growing set of graph ideas spanning live data, visualization, automation, and generative media.

### Captain’s log, Aug 27, 2026

released mkpages 0.4.1 after adding PDF, DOCX, and rendered-site ZIP exports in 0.4.0, plus the new Gridline theme and nested documentation card panels

### Captain’s log, Aug 25, 2026

shipped distman 0.8.4 with ad-hoc --source / --dest deployments that work without a dist.json, after migrating the distman docs site to mkpages

### Captain’s log, Aug 21, 2026

released mkpages 0.3.1 with built-in social preview cards, Open Graph/Twitter metadata, and GitHub Pages-aware image URLs

### Captain’s log, Aug 19, 2026

restored pyseq’s Sphinx API docs and objects.inv for Intersphinx compatibility while keeping the main docs site built with mkpages

### Captain’s log, Aug 18, 2026

released mkpages 0.2.3 with favicon support and a live-reloading preview workflow, then migrated the envstack, pathbase, and cropbox docs sites to build with mkpages

### Captain's log, Aug 16, 2026

shipped `mkpages` to PyPI and moved `rsg.io` to a simple markdown tree built with `mkpages`

### Captain's log, Jul 26, 2025

published subfork badge module to npm, loading from cdn

### Captain's log, Jul 25, 2025

shipped new site via [subfork](https://subfork.com)
