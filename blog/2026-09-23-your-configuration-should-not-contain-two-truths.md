---
layout: default
title: "Your Configuration Should Not Contain Two Truths"
date: 2026-09-23
description: "Configuration precedence and variable expansion are one resolution problem, not two independent phases."
permalink: /blog/your-configuration-should-not-contain-two-truths/
tags: [configuration, environment, dotenv, python]
---

# Your Configuration Should Not Contain Two Truths

Configuration precedence sounds simple: load several sources, decide which one wins, and produce an environment.

Variable expansion also sounds simple: replace `${NAME}` with the value of `NAME`.

The trouble begins when a tool implements those as two unrelated operations.

Suppose the parent process already contains:

```bash
BASE=/opt/prod
```

And a project `.env` file contains:

```dotenv
BASE=/opt/dev
CACHE=${BASE}/cache
```

Now run the loader in “do not override existing environment variables” mode. The obvious effective result is:

```bash
BASE=/opt/prod
CACHE=/opt/prod/cache
```

But a surprisingly easy implementation produces this instead:

```bash
BASE=/opt/prod
CACHE=/opt/dev/cache
```

Both values are individually explainable. Together, they are nonsense. `BASE` won according to precedence, while `CACHE` was expanded against the value that lost.

The resulting configuration contains two different answers to the same question.

## The tempting implementation

A loader often grows in this order:

1. Read a file.
2. Expand its variables.
3. Merge the expanded values into the process environment.
4. Add an override flag later.

That works until precedence changes which definitions are effective. Expansion has already happened, so it cannot observe the outcome of the merge.

This is not just a dotenv edge case. The same bug appears anywhere configuration is layered: user and project settings, development and production scopes, site-specific overrides, command-line flags, secrets, or generated deployment environments.

If one stage selects values and another stage derives values from them, they must agree about the namespace being observed.

## Precedence changes the dependency graph

It is useful to stop thinking of interpolation as text replacement. It is dependency resolution.

In the example above, `CACHE` depends on `BASE`. Which definition of `BASE` it depends on is not known until precedence has been applied.

A coherent declarative resolver therefore looks more like this:

1. Parse every assignment without prematurely expanding it.
2. Apply precedence to select the effective raw definition for each name.
3. Build dependencies between those effective definitions.
4. Resolve expansions against that effective namespace.
5. Emit final values along with their provenance.

In compact form:

```text
parse -> select -> resolve -> emit
```

Not:

```text
parse -> resolve each source -> merge
```

The distinction matters whenever an override changes a value referenced elsewhere. An override is not merely replacing one leaf in a dictionary. It can change every derived value downstream of that leaf.

## Lexical expansion is valid—but it is a different model

There is another defensible interpretation. A file may be treated as a self-contained lexical scope:

```dotenv
BASE=/opt/dev
CACHE=${BASE}/cache
```

Under that model, the author explicitly means “build `CACHE` from the `BASE` declared in this file,” even if a higher-priority source later replaces `BASE`.

That would make `/opt/dev/cache` correct.

The problem is not that lexical expansion exists. The problem is silently mixing lexical expansion with effective-environment precedence while presenting the result as one ordinary environment.

A tool should choose and document its semantics:

- **Lexical expansion:** references bind within their source or scope.
- **Effective expansion:** references bind to the final winning definitions.

If both are supported, the syntax should make the choice explicit. Users should not need to infer binding rules from load order or implementation accidents.

For tools that advertise layered environment resolution, effective expansion is usually the least surprising default. If `BASE=/opt/prod` is the value a child process will receive, derived values should normally observe `/opt/prod` too.

## Provenance is part of the answer

Once configuration has multiple layers, printing the final value is not enough. A useful resolver should be able to explain:

- which source supplied the winning definition;
- which definitions were shadowed;
- which variables the value depended on;
- which expansion semantics were used;
- whether a value was missing, cyclic, or intentionally empty.

For the example, a diagnostic might say:

```text
BASE  = /opt/prod        source: process environment
CACHE = /opt/prod/cache  source: project.env
                         depends on: BASE (process environment)
```

That explanation is much more useful than dumping a large environment and asking someone to reverse-engineer it.

It also makes several failure modes testable. A configuration resolver should have explicit behavior for missing references, cycles such as `A=${B}` and `B=${A}`, escaping, empty values, and values inherited from the parent process. “Whatever happened during iteration” is not a resolution policy.

## One environment, one truth

I work on [envstack](https://envstack.dev/) because real environments rarely come from one file. They are composed from scopes, overrides, defaults, and runtime state. The interesting work is not parsing `KEY=value`; it is defining what the combined result means.

The general rule is simple:

> Precedence and expansion cannot be independent phases if they are allowed to observe different environments.

This applies well beyond environment variables. Template systems, deployment manifests, build configuration, secrets managers, and layered application settings all face the same choice.

When a value wins, its dependents should either observe that winning value or clearly declare that they are bound to another scope. Anything in between creates a configuration that can contradict itself while still looking perfectly valid.

And those are the worst configuration bugs: not values that fail to parse, but values that parse cleanly into two different truths.
