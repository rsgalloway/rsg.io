---
layout: article
title: "An Image Sequence Is Not a List of Files"
date: 2026-11-02
description: "A filesystem can show which frames exist, but only production context can say which frames should exist. Sequence identity and frame expectations are different data."
permalink: /blog/an-image-sequence-is-not-a-list-of-files/
tags: [vfx, animation, pipelines, python, pyseq]
---

# An Image Sequence Is Not a List of Files

Suppose a render directory contains:

```text
beauty.1001.exr
beauty.1004.exr
beauty.1007.exr
beauty.1010.exr
```

Is that sequence complete?

It might be a perfectly valid step-three render:

```text
1001-1010x3
```

Or it might be a continuous render missing six frames.

The filesystem cannot tell you which interpretation is correct. The filenames are identical in both cases.

That reveals a distinction pipeline code often blurs: **the frames that exist are not the same thing as the frames that should exist**.

## There are three different objects

What we casually call “an image sequence” is usually three related objects:

1. **Artifact set** — the files currently present on disk or in object storage.
2. **Sequence identity** — the filename structure shared by those files: directory, head, varying numeric field, padding, and tail.
3. **Expected frame domain** — the frames production intends to exist, including range, step, handles, and deliberate omissions.

A directory scan gives you the first. A sequence library can derive the second and describe the observed frame set. The third must come from somewhere with production intent: a render job, manifest, edit, publish record, or explicit user input.

Collapsing all three into a list of paths makes basic questions surprisingly difficult:

- Are frames missing, or were they never requested?
- Is the render still growing?
- Are `1001` and `10001` members of the same padding convention?
- Which number in `shot010_comp_v012.1001.exr` is the frame?
- Does an empty directory represent a valid sequence with no artifacts yet, or nothing at all?

These are not filename-sorting problems. They are modeling problems.

## Sequence identity is structural

Consider:

```text
shot010_comp_v012.1001.exr
shot010_comp_v012.1002.exr
shot010_comp_v013.1001.exr
```

A generic “find the digits” expression sees shot, version, and frame numbers. A useful sequence detector must decide which numeric field varies while the rest of the filename remains stable.

The first two files form one sequence. The third belongs to another revision even though it shares a frame with the first.

The sequence identity is therefore not merely:

```text
directory + extension
```

It is closer to:

```text
directory + head + frame-position + padding + tail
```

That structure is why a compressed reference such as:

```text
shot010_comp_v012.%04d.exr [1001-1100]
```

is more than pretty formatting. It identifies the invariant parts of the filenames, the varying field, and the observed membership without enumerating one hundred paths.

[pyseq](https://pyseq.dev/) exists for this layer. It groups numbered filenames into sequence objects, preserves padding, formats broken or stepped ranges, and can expose missing frames relative to the observed minimum and maximum.

But that last phrase matters: *relative to the observed range*.

## “Missing” requires an expectation

Given these files:

```text
sim.1001.vdb
sim.1002.vdb
sim.1005.vdb
```

It is reasonable for a sequence tool to report:

```text
sim.%04d.vdb [1003-1004]
```

That is a useful structural observation: frames 1003 and 1004 are absent between the lowest and highest observed frames.

It is not yet proof of a production error.

Perhaps frame 1005 is a checkpoint. Perhaps the simulation was requested with an irregular sample set. Perhaps frames 1003 and 1004 failed. The sequence object cannot distinguish those histories because the artifact set is the same.

Likewise, the observed set `1001, 1004, 1007, 1010` can be compactly represented as `1001-1010x3`. That describes a pattern in the data. It does not prove that step three was intended.

To validate completeness, compare two explicit sets:

```text
observed = frames discovered in storage
expected = frames declared by production context

missing    = expected - observed
unexpected = observed - expected
```

Now “missing” has a precise meaning. It is no longer inferred solely from the gaps between filenames.

## Presence is not readiness

Even when observed and expected ranges match, the sequence may not be ready.

A renderer can create the final filename before it finishes writing the file. A directory scanner can see frame 1100 while frame 1072 is still being copied. A retry can replace frames after validation has already started.

Sequence completeness therefore needs a second boundary:

```text
all expected artifacts observed
and
the producer has committed the output as complete
```

That commit might be a job state, manifest, publish transaction, or atomic marker. The mechanism matters less than the semantics: consumers should not have to guess whether a stable-looking directory is still changing.

This is why polling a render directory is not a complete integration contract. It automates observation, not readiness.

## Give each layer one job

A robust sequence handoff can remain pleasantly small:

1. Discover and group the artifacts that actually exist.
2. Represent their sequence identity and observed frames compactly.
3. Obtain the expected frame domain from an authoritative source.
4. Compare expected and observed membership.
5. Accept the sequence only after the producer declares it complete.

Path semantics can be validated separately. A tool such as [pathbase](https://rsgalloway.github.io/pathbase/) can establish that `shot010`, `comp`, and `v012` are meaningful tokens under the applicable convention. That does not replace sequence detection, and sequence detection does not prove that the path refers to a valid production entity.

Each layer becomes more reliable when it stops pretending to know the others.

The filesystem can tell you which frames exist.

A sequence library can tell you how those files relate.

Only production context can tell you which frames ought to exist.
