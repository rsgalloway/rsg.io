---
layout: article
title: "When Environment Variables Reference Themselves"
date: 2026-10-20
description: "Why self-references, inheritance, and late binding make layered environment configuration harder than it looks."
permalink: /blog/when-environment-variables-reference-themselves/
tags: [python, envstack, environment, configuration]
---

# When Environment Variables Reference Themselves

At first glance, this looks like an entirely reasonable way to add a directory to a search path:

```yaml
all:
  PYTHONPATH: /my/tool/lib/python:${PYTHONPATH}
```

The new directory goes first, the existing value follows, and everyone gets on with their day. In a shell, the meaning is straightforward: expand `PYTHONPATH` **now**, using its current value.

But what if that assignment lives in an environment file that includes another environment file? And that file includes two more, both of which extend `PYTHONPATH`? What does “current” mean when none of these assignments has executed yet?

That question exposed a bug in [envstack](https://github.com/rsgalloway/envstack), my hierarchical environment manager. Fixing it turned out to be less about concatenating strings and more about defining what variable references *mean* in a layered configuration system.

## The case of the disappearing paths

Consider four small stack files. A shared base adds a directory; two tools extend it; an application includes both tools and adds one last entry.

**`default.env`**

```yaml
all:
  PYTHONPATH: /base:${PYTHONPATH}
```

**`toola.env`**

```yaml
include: [default]
all:
  PYTHONPATH: ${PYTHONPATH}:/toola
```

**`toolb.env`**

```yaml
include: [default]
all:
  PYTHONPATH: ${PYTHONPATH}:/toolb
```

**`app.env`**

```yaml
include: [toola, toolb]
all:
  PYTHONPATH: ${PYTHONPATH}:/app
```

Assume the launching shell has `PYTHONPATH=ORIG`. Resolving the application should produce:

```text
/base:ORIG:/toola:/toolb:/app
```

The base is included by both tools, but should be loaded only once. Each later self-reference should extend the result of the earlier layers.

Before the fix, intermediate entries could disappear. In the original bug report, including multiple tools left only the last tool's addition alongside the shell value. The application could likewise retain `/app` while dropping `/base` and `/toola`.

Nothing was wrong with the individual files. The problem was the definition of *which value* `${PYTHONPATH}` referred to.

## A shell is not a stack resolver

It is tempting to treat a sequence of environment files like a shell script:

```bash
PYTHONPATH="/base:$PYTHONPATH"
PYTHONPATH="$PYTHONPATH:/toola"
PYTHONPATH="$PYTHONPATH:/toolb"
PYTHONPATH="$PYTHONPATH:/app"
```

That model works because the shell executes assignments in order. Each statement sees the value produced by the statement before it.

A layered environment is different. It contains definitions to be composed and *then* resolved. In envstack, references to other variables are generally **late-bound**: they see the final definition in the assembled stack, even if that definition appears in a later file.

Self-references need different semantics. If `PYTHONPATH` simply looked up its final definition, `${PYTHONPATH}` would point right back to itself. If it always looked at the shell, every layer would ignore the accumulated stack value.

The useful rule is:

> When a definition of `VAR` references `${VAR}`, use the preceding definition of `VAR` in stack load order. Use the launching shell's value only if no earlier stack definition exists.

So each self-reference is a continuation of the value built so far, not a fresh read from `os.environ`.

The original implementation had two problems working against that rule: shell values could take precedence over inherited values during modifier evaluation, and separately resolved includes could lose intermediate definitions. The fix retains the chain of definitions and resolves self-references against the earlier value in that chain.

## Except other variables are still late-bound

Now for the slightly uncomfortable part: we *don't* want every reference to use an earlier snapshot.

Suppose a base environment defines a deployment root and a Python path derived from it:

**`base.env`**

```yaml
all:
  TOOL_ROOT: /tools/default
  PYTHONPATH: ${TOOL_ROOT}/lib/python
```

An application overrides the tool root:

**`app.env`**

```yaml
include: [base]
all:
  TOOL_ROOT: /tools/production
```

The resulting `PYTHONPATH` should be:

```text
/tools/production/lib/python
```

The base file didn't freeze `TOOL_ROOT` when it was read. Its `PYTHONPATH` expression still refers to the final `TOOL_ROOT` definition. That's important when an application needs to choose a different version or deployment location for a shared tool.

This means resolution is neither ordinary top-to-bottom assignment nor naive string interpolation. **A reference to a different variable uses the final stack; a self-reference reaches backward through that variable's definition history.**

Indirect cycles add another wrinkle. Imagine a base stack with `FOO: /base` and `BAR: ${FOO}`, followed by an application that sets `FOO: ${BAR}:/app`. `BAR` still refers to the final `FOO`, but the resolver can break the cycle by consulting the preceding `FOO` definition. Both ultimately resolve to `/base:/app`.

YAML key order is not an execution order. Treating it as one would make a configuration format surprisingly fragile.

## Empty is a value, not an invitation

Inheritance also needs an explicit way to *stop* inheriting.

```yaml
all:
  PYTHONPATH: ""
```

That is not the same as omitting `PYTHONPATH`. An absent variable can fall back to the shell; an explicitly empty value overrides both the inherited stack value and the shell value. In a later layer, another definition can build a new path without reviving directories from before the reset.

Likewise, a literal replacement is a reset rather than an append:

```yaml
all:
  PYTHONPATH: /replacement
```

Defaults complicate the picture. envstack supports Bash-like forms including `${VAR:-fallback}` (use a fallback without assigning it) and `${VAR:=fallback}` (make a fallback available during resolution). Both consider an empty value eligible for a fallback, but that does **not** mean a bare `${VAR}` may disregard an explicit empty definition.

There is another subtlety with self-defaults:

```yaml
all:
  LOG_LEVEL: ${LOG_LEVEL:=INFO}
```

If nothing supplies `LOG_LEVEL`, this definition resolves to `INFO`. The temporary assignment is scoped to resolution; it must not become a global value that shadows a later stack override. Otherwise a convenient default quietly defeats inheritance.

A resolver has to distinguish **missing**, **explicitly empty**, **inherited**, and **assigned as a fallback**. Flatten those into one “falsey” state and precedence bugs follow.

## What actually changed

The solution in [PR #141](https://github.com/rsgalloway/envstack/pull/141) was to make stack resolution aware of layered definitions instead of treating included environments as independent, already-resolved dictionaries.

That allows the resolver to preserve several properties at once:

- **Accumulation:** self-references extend previous stack values, starting from the shell only when necessary.
- **Late binding:** references to other variables use the final definitions, so application overrides still work.
- **Intentional resets:** `""` and literal replacements can cut off inherited values.
- **Scoped defaults:** `:=` supplies values during resolution without accidentally overruling later definitions.
- **Stable composition:** shared includes are processed once, and selected-platform path rules are preserved during resolution.

The fix also added regression tests for shared includes, successive stack arguments, overrides, and cross-platform path handling. These aren't especially glamorous test cases. They are exactly the sort that prevent a configuration system from becoming a collection of exceptions.

## The broader lesson

`PATH` and `PYTHONPATH` look like strings, but they behave more like little programs: each layer says something about what should be kept, extended, replaced, or derived from another value.

As soon as configuration supports includes, overrides, and variable references, it needs a resolution model. The important questions are not just *what is the final value?* but *which definition did this reference mean, and when was that decision made?*

The [original issue](https://github.com/rsgalloway/envstack/issues/140) was about missing Python search paths. The underlying bug was about evaluation semantics. Those are harder to debug, but much more useful to get right.

For the complete rules and additional examples, see the [envstack variable expansion documentation](https://github.com/rsgalloway/envstack/blob/master/docs/expansion.md). The changes shipped in [envstack 1.0.5](https://github.com/rsgalloway/envstack/releases/tag/1.0.5).
