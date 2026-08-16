---
layout: default
title: "Building small open source sites without a framework"
date: 2026-08-05 07:30:00 -0700
permalink: /blog/building-small-open-source-sites/
project: pyseq
type: essay
tags:
  - web
  - jekyll
  - open-source
excerpt: "A content-first site usually benefits more from restraint than from another abstraction layer."
---

For a project site that mostly serves Markdown, release notes, and a few landing pages, the value of a full application framework is often overstated.

Jekyll still holds up because the content model is obvious, the output is static, and the hosting story is simple. That lets the repository stay focused on writing rather than build orchestration.

The tradeoff is that you accept a little more HTML and CSS by hand. In return, the system remains small enough to understand in one sitting.
