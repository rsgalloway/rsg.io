---
layout: default
title: "Your .env File Is Not the Configuration"
date: 2026-08-31
description: "The hard part of environment configuration is not parsing key/value pairs. It is deciding which value wins when files, shells, defaults, secrets, and deployment context collide."
permalink: /blog/your-env-file-is-not-the-configuration/
tags:
  - envstack
  - configuration
  - dotenv
  - devops
  - python
---

A `.env` file is easy.

```text
API_URL=https://api.example.com
LOG_LEVEL=info
```

Parse a few key/value pairs, put them in the process environment, and launch the application.

The trouble starts when there is more than one source of configuration.

Maybe your shell already contains:

```bash
export API_URL=https://api.prod.example.com
```

while the repository contains:

```text
API_URL=https://api.staging.example.com
```

Which one wins?

That question looks small. It is not.

Once an application has defaults, `.env`, `.env.local`, CI variables, shell exports, deployment-specific values, secrets, and command-line overrides, the important part of configuration is no longer the file format.

It is **precedence**.

## Silent precedence is configuration debt

A recent [Aider issue](https://github.com/Aider-AI/aider/issues/5622) is a good example.

Aider was loading project `.env` files with override behavior enabled. That meant a value checked into or placed in the project could silently replace a variable the user had explicitly exported in their shell.

The immediate bug is straightforward. The interesting part is the class of failure.

Imagine:

```bash
export OPENAI_API_BASE=https://company-gateway.example.com
export OPENAI_API_KEY=...
```

Then you clone a project containing:

```text
OPENAI_API_BASE=https://some-other-endpoint.example.com
```

If the file silently wins, the application still starts. Nothing necessarily crashes. It just talks to a different service than the operator intended.

That is much worse than a parse error.

Configuration bugs are often dangerous precisely because they produce valid values.

## Loading is not composition

Most dotenv libraries answer a useful, narrow question:

> How do I load these values from a file?

Real applications eventually need to answer a different one:

> How do several sources of configuration combine?

Those sources might look something like:

```text
application defaults
        ↓
shared environment
        ↓
deployment environment
        ↓
project configuration
        ↓
developer overrides
        ↓
runtime overrides
```

There is no universally correct order.

A developer workstation may want local values to win. A production launcher may intentionally make operator-provided values authoritative. A test runner may need a temporary layer that overrides everything else.

The important property is not one particular policy.

It is that the policy is **defined, deterministic, and inspectable**.

If two engineers cannot look at the same configuration inputs and predict the same output, the configuration system has become implicit state.

## "Where did this value come from?"

This is the debugging question I care about most.

Suppose an application sees:

```text
DATABASE_URL=postgres://db-prod-03/...
```

It is useful to know the value.

It is much more useful to know:

```text
DATABASE_URL
  default.env       -> postgres://localhost/...
  shared.env        -> postgres://db-dev/...
  production.env    -> postgres://db-prod-03/...
```

Now the value has provenance.

This is one of the reasons I built [envstack](https://envstack.dev/). It treats environment configuration as a set of ordered layers rather than a single file, and it can trace where resolved variables came from.

## A small, concrete stack

Say a service has a shared baseline and a project-specific override:

```text
/srv/env/shared/myservice.env
/srv/projects/payments/env/myservice.env
```

The shared file might set `API_URL=https://api.internal.example.com` and `LOG_LEVEL=info`. The project file can set only `LOG_LEVEL=debug`, without copying every shared value. Then the launch environment makes the precedence rule visible:

```bash
export ENVPATH=/srv/projects/payments/env:/srv/env/shared
envstack -- ./bin/myservice
```

Earlier entries in `ENVPATH` have higher precedence, so the payments project can override the shared log level while retaining the shared API URL. Reversing those two directories reverses that decision. The important part is that the order is data an operator can inspect, not an accidental consequence of whichever dotenv call happened last.

When the result is surprising, trace a variable instead of guessing:

```bash
envstack -t LOG_LEVEL
```

That trace shows the layers considered and the value that won. It is a small feature, but it changes the debugging conversation from “why is this set?” to “which layer set it, and should that layer outrank the others?”

The goal is not to replace environment variables.

It is to make the process that creates them visible.

## Secrets make the same problem more obvious

There has also been renewed debate around the Twelve-Factor App recommendation to put configuration in environment variables.

That distinction matters.

A process may ultimately need a secret in memory or in its environment, but that does not mean the secret should live as plaintext in a repository or on disk.

That is also the model envstack uses for its optional encrypted values. It supports [AES-GCM and Fernet encryption](https://envstack.dev/secrets/) for data at rest, with keys supplied separately when the environment is resolved.

Importantly, that does **not** make envstack a replacement for Vault, KMS, SOPS, or another full secret-management system. Once a secret is exposed to a running process, a different set of security concerns applies.

Again, the useful idea is separation:

```text
stored configuration
        ↓
composition + precedence
        ↓
resolution / decryption
        ↓
process environment
```

Treating all four stages as "dotenv" hides too much.

## Configuration should be explainable

I think a healthy configuration system should be able to answer a few basic questions without requiring source-code archaeology:

- What inputs were used?
- In what order were they applied?
- Which source supplied this value?
- Which source overrode it?
- What will the final process receive?
- Can I reproduce that result somewhere else?

If the only way to answer those questions is to know the exact call order of three libraries, inspect a shell profile, read a CI definition, and remember which framework loads `.env.local` first, the system is already too implicit.

The implementation does not need to be complicated.

The model needs to be explicit.

## The `.env` format is still useful

None of this is an argument against `.env`.

Quite the opposite.

`KEY=value` is portable, understandable, easy to generate, easy to inspect, and directly compatible with the process environment. That simplicity is why it has survived.

The mistake is expecting one flat file to also define a configuration architecture.

A `.env` file is a representation.

Your **configuration** is the set of inputs, precedence rules, transformations, and runtime context that produced the final environment.

Once you make that distinction, a lot of confusing behavior becomes easier to reason about.

Parsing the file was never the hard part.

Deciding which value wins is.
