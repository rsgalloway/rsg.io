---
layout: default
title: "The File I Didn't Know Was an API"
date: 2026-08-22
description: "A documentation migration removed a machine-readable file I didn't know anyone used—and exposed a hidden compatibility contract."
permalink: /blog/the-file-i-didnt-know-was-an-api/
tags:
  - python
  - documentation
  - sphinx
  - pyseq
  - mkpages
---

I recently changed how the [pyseq](https://pyseq.dev) documentation site is built.

The main site moved to [mkpages](https://mkpages.dev), a small tool I am building to turn ordinary Markdown folders into Jekyll sites. The result was simpler to author and easier to keep consistent with my other projects.

Then someone opened an issue.

The documentation looked fine, but `objects.inv` had disappeared.

If you do not use Sphinx, `objects.inv` is easy to overlook. It is a generated inventory used by Intersphinx so one project's documentation can link to documented Python objects in another project.

It is not a page a person normally visits. It has no navigation, typography, or carefully written introduction. It is just a machine-readable build artifact.

But somebody was depending on it.

That was the useful surprise. I thought I had changed a documentation site. From another project's perspective, I had broken an API.

## Documentation has more than one audience

We tend to think of documentation as prose presented to human readers. That is the visible part, but a mature documentation site often exposes several less-visible contracts:

- stable URLs and anchors;
- redirects from previous locations;
- search indexes, sitemaps, and feeds;
- downloadable build artifacts;
- machine-readable inventories such as `objects.inv`.

A replacement site can look better, load faster, and contain all the same prose while still breaking its downstream users.

That makes documentation migrations surprisingly similar to software migrations. Visual inspection is necessary, but it is not sufficient. The old system may have been producing useful behavior nobody remembered specifying.

In this case, the issue was precise: Intersphinx had previously found the inventory at the old documentation domain, but it was unavailable from the new site. The report immediately clarified the requirement.

The right response was not to abandon the new site. It was to stop treating the choice of documentation tools as all-or-nothing.

## The hybrid build

The resulting [pyseq change](https://github.com/rsgalloway/pyseq/pull/98) combines two systems:

- [mkpages](https://github.com/rsgalloway/mkpages) builds the authored documentation site and navigation.
- Sphinx builds the generated API reference under `/api/`.
- The Sphinx output supplies `objects.inv`.
- The publishing workflow merges both outputs into one GitHub Pages site.

Each tool now handles the part it is good at.

The main documentation remains Markdown-first and consistent with my other project sites. Sphinx retains the Python-aware behavior that downstream documentation depends on.

The architectural lesson is not specifically about Jekyll or Sphinx. Replacing a system does not require replacing every capability it previously supplied. Sometimes the cleaner design is a composition.

## Hidden consumers are still consumers

Maintainers can usually identify the public functions, command-line options, and configuration formats they support. Generated artifacts are easier to miss because nobody deliberately designed them as a public interface.

They simply existed long enough for someone to use them.

That does not mean every historical artifact must be supported forever. It does mean migrations should begin with a wider inventory:

1. What do humans read?
2. What URLs might they have bookmarked?
3. What files do other tools retrieve?
4. What build artifacts do integrations consume?
5. What behavior exists even though it was never documented as a feature?

Open-source users are often the only practical integration test for these hidden contracts. In this case, one concise issue led to a better architecture within a day.

The next time I replace a static-site or documentation generator, I will inspect more than the rendered pages.

A file does not stop being an API just because I did not know anyone was calling it.
