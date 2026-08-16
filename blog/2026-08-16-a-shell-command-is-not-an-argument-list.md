---
layout: default
title: "A Shell Command Is Not an Argument List"
date: 2026-08-16
description: "A subtle Python subprocess bug reveals why argv lists, Windows command lines, and shell programs are fundamentally different representations."
permalink: /blog/a-shell-command-is-not-an-argument-list/
tags:
  - python
  - subprocess
  - shell
  - portability
  - distman
---

I recently ran into a subtle subprocess problem while working on [Distman](https://distman.dev/)'s transform pipelines.

Distman distribution files are JSON, and a transform may intentionally run an arbitrary shell command. That last detail matters: these commands are not merely executable names followed by arguments. They may use pipes, redirects, environment expansion, conditionals, or other shell syntax.

The implementation used `shell=True`, which is appropriate for those intended semantics.

The suspicious part was the use of Python's `subprocess.list2cmdline()` to turn a sequence back into a command string.

The function's name sounds generic. It isn't.

`list2cmdline()` applies the quoting rules used by the Microsoft C runtime. Those rules are useful when constructing a Windows command line for a program that will later recover an argv-style list.

They are not POSIX shell quoting rules.

On Linux, `shell=True` generally means the command string is interpreted by a shell such as `/bin/sh`. That shell has its own grammar for quotes, variables, pipes, redirects, substitutions, and metacharacters.

The result is an uncomfortable pipeline:

1. Begin with values that resemble an argument list.
2. Serialize them using Windows command-line rules.
3. Hand the serialized result to a POSIX shell.
4. Hope the shell reconstructs the intended command.

It may work for ordinary inputs. The bug appears when the command contains the exact things a transform pipeline is expected to support: spaces, nested quotes, variables, shell operators, or platform-specific paths.

The deeper problem is that three different concepts are being treated as interchangeable.

An **argument list** is already parsed:

```python
["tool", "--output", "my file.txt"]
```

A **Windows command line** is a string that the receiving runtime may later split into arguments according to Windows conventions.

A **shell command** is a small program:

```sh
tool input.exr | another-tool > "my file.txt"
```

These representations overlap for simple commands, but they are not equivalent.

The conventional subprocess guidance is straightforward when shell features are unnecessary: use `shell=False` and pass an argument list. Python can then preserve the argument boundaries directly without asking another parser to interpret the command.

But Distman's transform pipelines intentionally allow shell programs. Removing `shell=True` would remove part of the feature rather than fix the bug.

In that case, the cleanest model is usually to treat the authored command as a command string from the beginning. If the configuration contains shell syntax, preserve that syntax instead of tokenizing it and attempting to reconstruct it with an unrelated quoting algorithm.

This also makes the security boundary clearer.

It is common to say that `shell=True` is dangerous. More precisely, it is dangerous when untrusted data is inserted into a shell program without appropriate controls.

A Distman transform definition that permits arbitrary shell commands is already executable configuration. The person allowed to edit that file is effectively allowed to run code. Pretending otherwise through clever quoting does not create a meaningful security boundary.

That does not make interpolation automatically safe. Values originating outside the trusted configuration still need careful treatment. But the design should acknowledge where trust actually lives: in who controls the transform definition and which values may enter it.

Portability requires explicit semantics too.

Does a transform target the native shell on each platform? Are separate Windows and POSIX commands allowed? Which shell features are promised? How are environment variables expressed? A command that depends on Bash syntax is not portable merely because Python can launch it on multiple operating systems.

The tests should reflect those promises, including commands containing:

- spaces and empty arguments;
- single and double quotes;
- environment variables;
- pipes and redirects;
- shell metacharacters;
- Windows paths and backslashes;
- non-ASCII characters.

The lesson is larger than one helper function.

Helpful utilities often hide a very specific model beneath a generic-looking name. Before using a quoting function, it is worth asking two questions:

**Who is producing this string?**

**Which parser will consume it?**

If those answers describe different command-line grammars, no amount of wishful portability will make them compatible.

A shell command is not an argument list—and converting between them is not a neutral formatting step.
