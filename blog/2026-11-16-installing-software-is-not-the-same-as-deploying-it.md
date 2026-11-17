---
layout: article
title: "Installing Software Is Not the Same as Deploying It"
date: 2026-11-16
description: "Package installation produces files for an environment. Deployment adds ownership, destinations, revisions, activation, and lifecycle—and those are different problems."
permalink: /blog/installing-software-is-not-the-same-as-deploying-it/
tags: [python, packaging, deployment, pipelines, distman]
---

# Installing Software Is Not the Same as Deploying It

This command looks complete:

```bash
pip install numpy
```

It names a package, resolves dependencies, selects a compatible distribution, and installs files into a Python environment. For a developer working inside a virtual environment, that may be the entire job.

For a production pipeline, it is often only the beginning.

Suppose the package must be available to artists, render workers, and automation across Linux and Windows, using more than one Python runtime. Now we need answers that are not contained in the requirement `numpy`:

- Where should each runtime-specific build live?
- Which revision is currently active?
- Who owns the installed modules and commands?
- Can an upgrade replace another package's files?
- What should uninstall remove, and what history should it retain?
- What happens if publication is interrupted halfway through?

Those are not package-resolution questions. They are deployment questions.

## Installation produces files; deployment produces managed state

Python installers are very good at turning requirements into an environment. Pip identifies requirements, resolves dependencies, builds or selects wheels, and installs their contents. Tools such as uv add fast resolution, locking, interpreter management, and reproducible project environments.

The resulting environment is usually the unit of ownership. Recreate or synchronize the environment and its contents change together.

A centrally managed production deployment has a different unit of ownership. Multiple applications may share a library root. Commands may be consumed without a project checkout. Linux, Windows, Python 3.11, and Python 3.12 builds may need to coexist. A single package upgrade should not require rebuilding every consumer's environment.

In that model, installing bytes is an implementation step inside a longer lifecycle:

```text
requirement -> resolved artifacts -> staged targets -> published revisions -> active selection
```

Each arrow adds information. Flatten the process back into “copy these files into `site-packages`” and you lose the ability to explain who owns the result or how it changed.

## A package version is not a deployment revision

These identifiers answer different questions:

```text
numpy 2.2.6       which upstream software?
deployment rev 3  which publication of its targets?
```

The same upstream package version can be published again because the selected runtimes, destination policy, launchers, or prepared contents changed. Conversely, an attempted install may discover that the existing retained target already has identical hashes and modes, requiring no new payload revision.

Treating the package version as the complete deployment identity collapses provenance into naming. Treating every publication as a new package version invents upstream releases that do not exist.

The useful model keeps both.

## What distman 0.9.0 adds

[distman 0.9.0](https://github.com/rsgalloway/distman/releases/tag/0.9.0) adds Python package acquisition to an existing versioned file-deployment system. The interface is intentionally familiar:

```bash
distman install numpy
distman install -r requirements.txt
distman install ./myapp
```

The first resolves a PyPI requirement. The second installs a requirements file. The third inspects a local Python project, builds it, installs its dependencies, and can also run that project's `dist.json` targets when present.

But the output is not an ordinary virtual environment. [The installation policy](https://distman.dev/install/) maps wheel contents into managed deployment targets. Platform-independent libraries can share a Python path, while binary packages can occupy package-, platform-, architecture-, and Python-specific paths. Commands and top-level modules become independently owned targets rather than anonymous neighbors in a mutable directory.

For example, a pure package can appear through active links like:

```text
tools/lib/python/
    example -> versions/example.2
    example-1.4.dist-info -> versions/example-1.4.dist-info.1
```

Central records under the deployment root retain the package version, source, dependencies, runtime selections, file inventory, hashes, modes, and target ownership. Installing another distribution that claims an already-owned command or module is a collision, not an implicit overwrite.

Normal uninstall removes the selected active links but retains inactive payloads and revision records. `--delete` can remove matching inactive history. Removal is rejected when it would break a retained dependent unless the operator explicitly forces it. Dependencies are not automatically garbage-collected.

That is the distinction in practice: pip-compatible acquisition feeds a deployment lifecycle rather than replacing it.

## Cross-platform does not mean cross-compilation

Distman can select compatible prebuilt wheels for Linux, Windows, and macOS and for specified Python runtimes:

```bash
distman install 'numpy==2.2.6' \
    --platform linux,windows \
    --arch x86_64 \
    --python 3.11,3.12 \
    --dryrun
```

That does not make the local machine a universal build farm. Dependencies need compatible wheels. Local projects build on the host, and native cross-compilation is not provided. Foreign dependency markers and extras have limitations, so complex multi-platform deployments should use tested, pinned requirements.

The distinction matters because “supports multiple platforms” can otherwise imply much more than artifact selection and layout.

## This is not a replacement for every package manager

The tools overlap, but their primary state differs:

| Tool | Primary managed object |
|---|---|
| pip | Packages installed into a Python environment |
| uv | Locked Python projects, interpreters, tools, and synchronized environments |
| Conda | Activated environments containing Python and non-Python packages |
| Rez | Centrally stored packages composed into resolved runtime environments |
| distman | Versioned filesystem targets published into a managed deployment root |

Distman currently uses pip-backed resolution; it is not a new dependency solver. Unlike Conda, it does not package arbitrary system libraries. Unlike Rez, it does not yet construct named resolved environments. Installation does not modify the current shell; runtime paths must be supplied by environment policy, such as envstack, or configured directly.

It also does not yet provide whole-deployment rollback. Each target link is activated atomically on POSIX, but an operation spanning several links is not globally atomic to readers. Publication journals can recover interrupted install and uninstall operations; that is different from selecting an arbitrary historical snapshot.

These limitations are not footnotes to hide. They locate the tool's actual boundary.

## Deployment begins where installation stops

A package installer answers:

> What artifacts satisfy these requirements in this environment?

A deployment system must additionally answer:

> Where are those artifacts published, who owns them, which revision is active, which runtimes do they serve, and how can their lifecycle change safely?

[distman](https://distman.dev/) now accepts the familiar inputs of Python packaging while preserving those deployment questions instead of pretending they disappeared.

That is the point of `distman install`: not to rename `pip install`, but to make package installation one stage of a managed deployment.
