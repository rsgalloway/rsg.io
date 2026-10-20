---
layout: default
title: "Appending to PATH Is a Fold, Not an Assignment"
date: 2026-10-19
description: "Layered environments cannot be resolved by merging dictionaries and expanding variables afterward. Self-references turn path composition into a fold over definition history."
permalink: /blog/appending-to-path-is-a-fold-not-an-assignment/
tags: [python, configuration, environments, pipelines, envstack]
---

# Appending to PATH Is a Fold, Not an Assignment

Environment variables look like a dictionary:

```python
{"PATH": "...", "PYTHONPATH": "..."}
```

That model works until environments become composable.

Suppose an application includes three independently deployed Python tools. Each tool contributes its own import directory:

```yaml
# default.env
PYTHONPATH: /shared/lib/python:${PYTHONPATH}

# numpy.env
include: [default]
PYTHONPATH: ${PYTHONPATH}:/tools/numpy/lib/python

# pillow.env
include: [default]
PYTHONPATH: ${PYTHONPATH}:/tools/pillow/lib/python

# app.env
include: [numpy, pillow]
PYTHONPATH: ${PYTHONPATH}:/apps/viewer/lib/python
```

If the process begins with `PYTHONPATH=/local`, the intended result is:

```text
/shared/lib/python:/local:/tools/numpy/lib/python:/tools/pillow/lib/python:/apps/viewer/lib/python
```

Every file contains an assignment. But the result cannot be obtained by ordinary last-write-wins dictionary merging. Merge first and the only surviving definition is:

```yaml
PYTHONPATH: ${PYTHONPATH}:/apps/viewer/lib/python
```

The NumPy and Pillow contributions have already disappeared.

## The previous value is data

In a self-referential definition, `${PYTHONPATH}` does not mean “look up the final value of `PYTHONPATH`.” That would be a cycle. It means “use the value accumulated before this definition.”

The conceptual operation is a fold:

```text
x0 = process environment
x1 = evaluate(default.PYTHONPATH, self=x0)
x2 = evaluate(numpy.PYTHONPATH, self=x1)
x3 = evaluate(pillow.PYTHONPATH, self=x2)
x4 = evaluate(app.PYTHONPATH, self=x3)
```

Each definition consumes the previous result and produces the next one. The history is not incidental bookkeeping; it is an input to evaluation.

This is easy to miss because the final product really is a dictionary. The mistake is assuming the intermediate representation can also be one. A flattened mapping tells you the last definition of a variable, but not what a self-reference in that definition should observe.

## Include graphs make the bug harder to see

Real environment stacks are graphs, not tidy chains. NumPy and Pillow may both include `default`. OpenEXR may include NumPy itself. The application may include all three.

The shared base should contribute its path once, while each tool should extend the result in load order:

```text
default -> numpy -> pillow -> openexr -> app
```

A resolver that recursively evaluates every include can apply `default` repeatedly. A resolver that deduplicates includes but retains only final values can lose intermediate contributions. Both approaches can appear correct with one parent and fail only when the include graph becomes a diamond.

That is the sort of bug that survives simple configuration tests. `default -> app` works. `default -> tool -> app` may work. The failure appears when several reusable components all extend the same variable through a shared include.

## Append, replace, and clear are different operations

Once earlier definitions are preserved, three useful operations become unambiguous.

Append to the accumulated value:

```yaml
PYTHONPATH: ${PYTHONPATH}:/another/tool
```

Replace it:

```yaml
PYTHONPATH: /controlled/runtime
```

Clear it deliberately:

```yaml
PYTHONPATH: ""
```

The last two are resets. A later self-reference should continue from the replacement or empty value, not quietly resurrect paths from the shell or from an earlier include.

Explicit emptiness is especially important. Configuration systems often treat an empty string like a missing value and fall back to the parent environment. For search paths, that makes it impossible to say, “discard everything inherited before this point.” Missing and empty are different states.

## This still is not imperative YAML

Calling the operation a fold does not mean YAML key order should behave like a shell script.

Source order establishes the history of repeated definitions across included stacks. Within a resolved environment, ordinary references can remain late-bound to the final definition of another variable.

For example, a tool can define:

```yaml
NUMPY_ROOT: /tools/numpy/2.2.6
PYTHONPATH: ${PYTHONPATH}:${NUMPY_ROOT}/lib/python
```

and an application can override `NUMPY_ROOT` without copying or rewriting the inherited `PYTHONPATH` expression. The self-reference to `PYTHONPATH` uses its preceding value; the reference to `NUMPY_ROOT` uses the effective final root.

That distinction gives reusable stacks both accumulation and late binding. Treat every reference as a snapshot and overrides stop working. Treat every reference as final and self-references become cycles.

## The broader lesson

Many configuration formats advertise themselves as “just data.” Composition can quietly turn them into small evaluation languages.

The moment a value can refer to its own predecessor, the system needs semantics for:

- definition order across includes;
- shared includes in a graph;
- literal replacement and explicit clearing;
- process-environment fallback;
- late-bound references to other variables;
- platform-specific path separators and normalization.

Those semantics exist whether the implementation acknowledges them or not. If they are unspecified, users discover them through whichever edge case happens to break first.

[envstack 1.0.5](https://github.com/rsgalloway/envstack/releases/tag/1.0.5) fixes self-reference accumulation across included stacks and makes these rules explicit. Its public [tools and inheritance example](https://rsgalloway.github.io/envstack/examples/tools/) composes versioned NumPy, Pillow, and OpenEXR deployments across platforms and Python runtimes—the sort of case where a flat dictionary model stops being convincing.

An environment may end as a set of key-value pairs. But when those values build on one another, resolving it is not a merge followed by string substitution.

It is evaluation over history.
