---
layout: default
title: "v042 Is Not a Data Model: Multivariate Versioning in VFX Pipelines"
date: 2026-09-18
description: "VFX files rarely vary along only one axis. A rigorous model separates revisions from variants, representations, dependencies, and immutable artifacts."
permalink: /blog/v042-is-not-a-data-model/
tags:
  - vfx
  - pipeline
  - versioning
  - filesystems
---

# v042 Is Not a Data Model: Multivariate Versioning in VFX Pipelines

VFX pipelines love a single counter.

```text
dragon_comp_v001.exr
dragon_comp_v002.exr
dragon_comp_v003.exr
```

It is easy to sort, easy to explain, and easy to increment. It also stops describing reality almost immediately.

Was `v003` a new comp, a 2K proxy, an ACEScg conversion, an alternate matte, a stereo-eye fix, a client-review encode, or the same frames republished against newer animation? If all of those changes consume the same counter, the number tells us order but not meaning. If they get encoded into filenames, the filename slowly becomes a database with underscores.

I call the underlying problem **multivariate versioning**: production outputs do not change along one line. They occupy coordinates across several meaningful axes, and more than one axis may change at once.

The important part is not the term. It is refusing to model a vector as a scalar.

## A version needs a lineage

A version number is only meaningful inside a declared lineage. `v017` means “the seventeenth revision of *this thing*,” which immediately raises the useful question: what is *this thing*?

For example:

```text
shot       sh010
task       lighting
branch     main
variant    final-look
revision   17
```

Within that lineage, `v018` can reasonably supersede `v017`. But a slap-comp movie, a 2K EXR proxy, and a holdout pass are not necessarily revisions of the same thing. They may be representations or sibling variants derived from the same revision.

A practical production coordinate might include:

```text
(entity, task, branch, variant, representation, resolution,
 color_space, layer, frame_domain, review_state, release_lineage)
```

Not every studio needs every axis. The point is that these fields have different semantics. Flattening them into one counter erases those semantics.

## Revision, variant, representation, dependency, artifact

These words are often treated as synonyms. They should not be.

A **revision** is an ordered change within one lineage. Lighting `main/final-look v018` follows `v017` and is intended to replace it for the same purpose.

A **variant** is an intentional alternative that may remain valid beside its siblings: day versus night, clean plate versus damaged set, theatrical versus episodic crop, or an artist branch under active development. A variant is not “the next version” of another variant.

A **representation** is another encoding or packaging of the same logical result: EXR sequence, review QuickTime, JPEG thumbnail, 2K proxy, or platform-specific texture. Regenerating a proxy may create a new physical artifact without creating a new creative revision.

A **dependency** is an input that helped produce the result: animation publish, camera, LUT, texture set, renderer build, or configuration snapshot. A dependency change belongs in provenance. It may cause a new publish, but it is not itself a filename version.

An **artifact** is the immutable thing that actually exists: a particular manifest, movie, or set of frame files. It should have a durable publish ID, and often a content digest. Two paths can point to byte-identical artifacts; two artifacts called `v017` can be different bytes. The label is not identity.

This gives us a more honest model:

```text
publish = lineage + revision + coordinates + dependencies + artifacts
```

The revision orders publishes within a lineage. The coordinates say what kind of result this is. Dependencies explain how it was produced. Artifact IDs say exactly what was produced.

## A concrete shot example

Suppose lighting publishes:

```text
sh010 / lighting / main / final-look / v017
```

The publish contains a 4K ACEScg beauty sequence for frames 1001-1100. A farm job also creates a 2K proxy and an H.264 review movie.

Those three outputs do not need three creative version numbers. They can be three representations of revision 17, each with its own immutable artifact identity and derivation record.

Now the artist changes a key light. That is `v018` in the same lighting lineage.

The supervisor then asks for a moonlit alternative. That should probably be a new variant or branch with its own local revision history, not `v019` pretending the daylight version ceased to exist.

Later, the EXRs are republished because the show changes its delivery color transform. The pixels changed, but the lighting decisions did not. Whether that increments the lighting revision is a policy choice; the model should at least record that the changed dimension was representation/color processing, not authored lighting. A derived-artifact generation or release revision may be more accurate than advancing the creative lineage.

This distinction matters whenever someone asks, “What changed?” A scalar version can answer *which came later*. A multivariate record can answer:

- only the resolution changed;
- the creative revision stayed fixed, but the review encode was regenerated;
- the branch changed from `main` to `moonlit`;
- the frames are identical, but the dependency manifest changed;
- frames 1042-1056 changed while the rest were reused.

## Why filenames cannot carry the whole model

Studios often respond by adding more tokens:

```text
sh010_lgt_main_moonlit_beauty_4k_acescg_client_v017.1001.exr
```

This is useful up to a point. Human-readable paths are good. But every additional token creates parsing rules, migration problems, invalid combinations, and disagreements about ordering. Optional fields make the grammar worse. Renaming a file to correct metadata can also destroy the stable identity you were trying to describe.

The path should be a **projection** of structured data, not the authoritative record.

A publish manifest or registry can own the complete coordinate, lineage, dependency graph, frame coverage, and artifact digests. A path template can then render the subset useful to humans and existing tools. Libraries such as [pyseq](https://github.com/rsgalloway/pyseq) can recognize the frame-number dimension without pretending that the sequence name explains every other dimension.

Content hashing adds another independent axis. A tool such as [hashio](https://github.com/rsgalloway/hashio) can establish that two artifacts are byte-identical even when their paths and publish records differ. That is useful evidence, but a hash still cannot tell you whether two identical files represent the same approved publish, different delivery lineages, or an accidental duplicate. Identity, meaning, and content overlap; they are not interchangeable.

## The model does not need to become a monster

Multivariate versioning does not require a giant universal schema. Start with a few rules:

1. Define the lineage before incrementing its revision.
2. Give variants names and local histories instead of forcing them into one global counter.
3. Treat representations as derived outputs unless they have genuinely independent authorship.
4. Record dependencies and tool/configuration inputs as provenance.
5. Assign immutable IDs to publishes and artifacts; use content hashes where verification or deduplication matters.
6. Make comparison field-aware: report which coordinates, dependencies, frames, and bytes changed.

You can still put `v017` in the directory name. Artists should not need a graph database to find yesterday's render. The difference is that `v017` becomes one useful field in the model instead of being asked to carry the entire production history.

A single version counter is a good interface. It is a poor ontology.
