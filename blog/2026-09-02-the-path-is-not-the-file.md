---
layout: default
title: "The Path Is Not the File"
date: 2026-09-02
description: "Paths tell you where a file is. They do not reliably tell you what it is. That distinction matters for deduplication, caching, indexing, backups, and AI workloads."
permalink: /blog/the-path-is-not-the-file/
tags:
  - filesystems
  - hashing
  - snapfs
  - deduplication
  - storage
---

A file path looks like an identity.

```text
/projects/foo/render/final.exr
```

It is unique enough to use as a dictionary key. It is easy to put in a database. It is what users see. Most APIs hand it to you directly.

But a path answers only one question:

> Where is this file right now?

It does not necessarily answer:

> What file is this?

That distinction seems academic until you build anything that has to reason about files over time.

Consider three ordinary operations:

| Operation | Path changes? | Contents change? |
| --- | --- | --- |
| Rename a file | yes | no |
| Copy a file | yes | no |
| Edit a file in place | no | yes |

A rename can look like a deletion plus a brand-new file. A copy can look unrelated to the original. An in-place edit can look like the same object even though its contents changed.

The filesystem is behaving correctly. The problem is our model.

## Location identity and content identity are different

A path is a **location identity**. For many applications, that is exactly what you want. If you are opening `/etc/hosts`, the location is the contract.

But other systems care about **content identity**: whether two paths contain the same bytes.

A cryptographic hash gives us a convenient way to represent that:

```python
import hashlib

def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()
```

Now `/archive/photo.jpg` and `/backups/2025/photo-copy.jpg` can have different names, paths, and timestamps while producing the same content hash.

That lets a system say something stronger than "these paths are different":

> These locations contain the same bytes.

## This shows up immediately in deduplication

A recent question in r/DataHoarder asked for a duplicate finder that works even when two files have completely different names.

The answer is conceptually simple: names are irrelevant for exact duplicates. Compare content.

But finding identical content is only the first half of the problem.

Suppose you discover:

```text
/projects/showA/final/logo.png
/archive/showA/logo.png
/home/user/Desktop/logo-final-final.png
```

and all three hash to the same value.

You have proven that the bytes are identical. You have **not** proven that all three paths are interchangeable.

One may be part of a published project. One may be a backup governed by retention policy. One may have different permissions, ownership, or surrounding directory context.

"Same content" and "safe to delete" are different questions.

This is why I think duplicate detection is better modeled as **evidence**, not an action.

The hash tells you what is the same. Policy and context decide what to do about it.

## AI indexing has the same problem

This is not just a storage-cleanup problem.

A recent issue against the Onyx AI platform described a similar failure mode in a document-indexing pipeline. If the same document arrives through a different connector, filename, or path, it can receive a new document ID and be embedded again even though the underlying content is unchanged.

That means duplicate work and, when embeddings are billed by token or request, duplicate cost.

The connector ID answers:

> Which document record is this?

A content hash answers:

> Have I processed these bytes before?

Those are different questions, so they deserve different identities.

## Caches have been doing this for years

Content-addressed storage is not a new idea.

Git's object IDs are derived from object content and metadata. Build systems use content fingerprints to determine whether work can be reused. Package systems and artifact caches use hashes to verify and identify immutable blobs.

The pattern is powerful because it separates **where something lives** from **what it is**.

Instead of:

```text
cache["/project/foo/input.dat"]
```

you can reason about:

```text
cache[sha256(contents)]
```

Now a rename does not invalidate useful work. A second copy does not require the same work again. And a modification at the same path naturally produces a different identity.

That does not mean every filesystem database should replace paths with hashes. It means paths and hashes describe different dimensions of the same file.

## History adds a third dimension

While building [SnapFS](https://snapfs.com/), I keep coming back to this distinction.

For large shared storage, it is rarely enough to know only what exists at this instant. You also care about what is growing, what changed, what disappeared, and where churn is happening.

So there are really at least three useful questions:

```text
Where is it?        -> path
What content is it? -> hash / content identity
What happened?      -> history
```

Each tells you something the others cannot.

A path without history cannot tell you whether a file was renamed or appeared yesterday. A hash without a path cannot tell you where the content is used. A historical record without content identity may mistake moves and copies for unrelated events.

The useful model comes from keeping these concepts separate and combining them when needed.

## Hashes are not filenames with extra steps

There is a temptation to think of hashing as merely a duplicate-finding optimization.

It is more fundamental than that.

A stable content identity enables things like:

- avoiding repeated processing of identical inputs;
- understanding copies across otherwise unrelated directories;
- validating data after transfer;
- building caches that survive renames;
- distinguishing "same path" from "same data";
- reasoning about storage without trusting filenames.

And it also gives you a useful constraint: a hash says nothing about *meaning*.

Two byte-identical files are content-identical. Two differently encoded images showing the same picture are not. Two documents with equivalent text but different metadata are not.

If you need semantic identity, that is another layer again.

## Use the identity that matches the question

Paths are incredibly useful. So are inode numbers, database IDs, object keys, hashes, timestamps, and semantic fingerprints.

Problems start when we casually treat one of them as **the** identity of a file.

There usually isn't one.

If the question is "where do I open it?", use the path.

If the question is "have I seen these exact bytes before?", use a content hash.

If the question is "is this logically the same document?", you may need application-level identity.

The path is not the file.

It is one coordinate in a larger model.
