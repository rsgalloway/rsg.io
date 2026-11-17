---
layout: article
title: "One Sequence, One Checksum"
date: 2026-11-17
description: "Why a collection of numbered frames needs one stable, explainable identity—and how hashio and pyseq divide the work."
permalink: /blog/one-sequence-one-checksum/
tags:
  - hashio
  - pyseq
  - checksums
  - file-sequences
  - vfx
---

An image sequence occupies an awkward space in a filesystem.

To the filesystem, it is a collection of independent files:

```text
shot.1001.exr
shot.1002.exr
shot.1003.exr
```

To the production pipeline, it is usually one asset.

That difference matters when the pipeline needs to answer a simple question:

**Is this the same sequence?**

A checksum for each frame is useful, but it does not provide a single identity for the sequence. Comparing two deliveries still requires comparing two sets of filenames and hashes, accounting for missing frames, and deciding whether order or location matters.

[hashio 0.5.3](https://github.com/rsgalloway/hashio/releases/tag/0.5.3) adds a more direct answer: one aggregate checksum for a [pyseq](https://github.com/rsgalloway/pyseq) sequence.

```sh
hashio 'frames/shot.%08d.exr'
hashio 'frames/shot.%08d.exr 1001-1100'
```

The reference is resolved into its component frames, the frames are hashed through one shared worker pool, and the result is presented as one logical asset.

The interesting part is not producing another hash.

It is deciding what that hash means.

## Identity requires a contract

A naive sequence checksum could concatenate every frame and hash the resulting byte stream. That would be expensive, difficult to inspect, and ambiguous about frame boundaries.

It would also discard work already performed while calculating the individual file checksums.

Instead, [hashio](https://github.com/rsgalloway/hashio) builds the aggregate from canonical entries:

```text
filename:checksum
```

The entries are sorted, joined with newlines, and passed through the selected hash algorithm.

This gives the sequence digest a deliberate identity contract:

- Changing a frame's contents changes the digest.
- Adding or removing a frame changes it.
- Renaming a frame changes it.
- Moving the entire sequence to another directory does not.
- Filesystem timestamps do not affect it.
- Worker completion order does not affect it.
- The order in which inputs were supplied does not affect it.

Those choices are more important than the particular hash algorithm.

A digest is only useful when two people—or two systems—agree about which differences count.

For this use case, the parent directory is deployment context rather than asset identity. A sequence copied from an incoming delivery directory to archival storage should retain the same aggregate.

The filenames remain significant because they encode sequence membership. `shot.1001.exr` and `shot.1002.exr` are not interchangeable just because their contents happen to match.

This is not the only possible identity policy, but it is an explainable one.

## The summary should not replace the evidence

A single digest is convenient for databases, delivery records, cache keys, and quick comparisons.

But when it changes, somebody will want to know why.

That is why [hashio](https://github.com/rsgalloway/hashio) retains the per-frame checksums in its output manifest. The aggregate answers the first question:

> Is this sequence identical to the one I saw earlier?

The manifest answers the next one:

> Which frames changed?

This is a useful pattern beyond checksums.

Summary data makes comparisons inexpensive. Detailed data makes differences explainable. A system usually needs both.

The command-line behavior reflects that distinction. An explicit sequence prints one aggregate by default. Verbose mode also displays the individual frame hashes:

```sh
hashio 'frames/shot.%08d.exr' -v
```

A manifest can preserve those frame-level results for later verification:

```sh
hashio 'frames/shot.%08d.exr' -o hashes.json
```

The sequence can therefore participate in asset-level tracking without becoming an opaque blob.

## Partial sequences should not produce confident answers

The failure behavior matters too.

If a requested frame cannot be hashed, [hashio](https://github.com/rsgalloway/hashio) does not print the aggregate. It exits with an error instead.

That includes an explicitly requested frame that is missing or a selected frame excluded by an ignore rule.

It would be technically possible to hash whichever frames were available. The resulting digest would still be deterministic.

It would also be misleading.

A checksum for “the frames I happened to process” is not necessarily a checksum for the sequence the user requested. Refusing the aggregate preserves the stronger claim.

This is especially important in production workflows, where a file can be visible before it is complete and where missing frames are often the exact failure the verification step is supposed to detect.

Partial truth should not look like complete certainty.

## The dependency direction changed

The [original feature request](https://github.com/rsgalloway/hashio/issues/20) proposed adding [hashio](https://github.com/rsgalloway/hashio)-based hashing to [pyseq](https://github.com/rsgalloway/pyseq).

The eventual implementation went in the other direction.

[hashio](https://github.com/rsgalloway/hashio) now depends on [pyseq](https://github.com/rsgalloway/pyseq) for sequence parsing. The sequence library does not need to acquire its own hashing workers, cache, output formats, manifests, and verification behavior.

That boundary fits the responsibilities of the two projects:

- [pyseq](https://github.com/rsgalloway/pyseq) knows what a sequence is.
- [hashio](https://github.com/rsgalloway/hashio) knows how to hash and verify data.

Cross-project features often begin with the right capability attached to the wrong owner. Implementation is partly the process of finding the dependency direction that keeps both tools coherent.

The result is a small interface with a useful promise.

Many files can represent one asset.

Now they can also present one identity.
