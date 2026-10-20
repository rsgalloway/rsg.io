---
layout: default
title: "A Path That Parses Is Not Necessarily Valid"
date: 2026-10-12
description: "Path templates describe structure. Production conventions also need vocabulary, context, and rules that can vary by project and template."
permalink: /blog/a-path-that-parses-is-not-necessarily-valid/
tags: [python, vfx, pipelines, paths, pathbase]
---

# A Path That Parses Is Not Necessarily Valid

Suppose a VFX pipeline recognizes this template:

```text
/{show}/{sequence}/{shot}/{step}/{task}_{descriptor}_v{version:03d}.{frame:04d}.{ext}
```

And it successfully parses this path:

```text
/bunny/sq01/shot010/comp/final_beauty_v12.10001.exr
```

The parser can return a perfectly respectable dictionary:

```python
{
    "show": "bunny",
    "sequence": "sq01",
    "shot": "shot010",
    "step": "comp",
    "task": "final",
    "descriptor": "beauty",
    "version": 12,
    "frame": 10001,
    "ext": "exr",
}
```

It parsed. It may still be invalid.

Perhaps versions must contain exactly three digits, frames exactly four, and `comp` allows only `exr` and `mov`. Perhaps another show uses eight-digit frames, or calls the department `compositing`. The path template tells us where the tokens are. It does not, by itself, tell us which values belong there.

This is the difference between **path grammar** and **path policy**.

## Format width is not validation

One subtle source of false confidence is the format specifier.

```text
{frame:04d}
```

When formatting a value, `04d` means “write this integer with at least four digits, padded with zeroes.” It does not mean “reject any parsed value that is not exactly four digits.” `10001` is still an integer, so a parser can accept it even though the production convention expects `0001` through `9999`.

That behavior is correct for a formatting language. Minimum output width and exact input width are different constraints.

The same problem appears with versions. `v{version:03d}` formats `7` as `v007`, but the parser may still understand `v7` or `v1000`. If exact spelling matters, the convention needs an explicit rule:

```json
{
  "rules": {
    "version": "^[0-9]{3}$",
    "frame": "^[0-9]{4}$"
  }
}
```

Now the path is not merely structurally parseable. Its tokens must also satisfy the local vocabulary.

## A valid parse can also be the wrong parse

Rules do more than reject bad values. They can disambiguate where one token ends and another begins.

Consider:

```text
/{shot}_{task}.exr
```

Applied to:

```text
/s010_extra_comp.exr
```

If both fields accept arbitrary text, where should the split occur?

```text
shot = s010_extra, task = comp
```

or:

```text
shot = s010, task = extra_comp
```

Both satisfy the punctuation. Only production knowledge can tell us which interpretation is plausible.

Add a shot rule:

```json
{"shot": "^s[0-9]{3}$"}
```

The matcher can now locate the split that produces a valid shot. Validation is participating in parsing rather than running as an unrelated cleanup pass afterward.

That matters because a wrong-but-successful parse is often more dangerous than a hard failure. It can route files to the wrong entity, attach metadata to the wrong task, or generate a new path that looks authoritative.

## Some constraints belong in the template

Small, stable enumerations are part of the path’s visible grammar. [Pathbase 0.2.0](https://github.com/rsgalloway/pathbase/releases/tag/0.2.0) can express them inline:

```text
/{environment}/{service}/{date}/{level|debug|info|warning|error|critical}.log
```

The `level` token now accepts only the listed choices. A path ending in `verbose.log` does not match, and formatting with `level="verbose"` also fails.

Inline choices are useful because a reader can understand the complete local grammar without opening another configuration file. They work well for file extensions, stereo eyes, review states, or other short closed sets:

```text
{eye|left|right}
{state|wip|review|final}
{ext|mov|mp4}
```

Longer or shared conventions do not belong inside every template. That is where external rules become more useful.

## Policy needs layers

Studios rarely have one universal naming convention. They have a shared baseline followed by exceptions:

```text
studio -> project -> task -> tool
```

A studio may allow sequence names matching:

```text
^[a-z]+[0-9]+$
```

while one show requires:

```text
^seq[0-9]{3}$
```

Copying the entire studio ruleset into the show configuration creates drift. Changing one global extension list then requires editing every project copy.

Pathbase 0.2.0 instead allows `PATHBASE_RULES` to contain multiple JSON files, separated by the platform path separator. They layer from left to right, and later definitions replace earlier ones token by token:

```text
PATHBASE_RULES=/studio/path-rules.json:/shows/bunny/path-rules.json
```

The show can narrow `sequence`, `shot`, and `step` while inheriting the studio’s rules for `task`, `descriptor`, and `ext`.

Rules can also be scoped to one named template:

```json
{
  "rules": {
    "version": "^[0-9]{3}$"
  },
  "templates": {
    "PLATE_FILE": {
      "rules": {
        "frame": "^[0-9]{8}$"
      }
    }
  }
}
```

The version convention applies everywhere. Only `PLATE_FILE` requires eight-digit frames. This is more precise than declaring that the token named `frame` has one meaning across every path in the system.

## Regex is not production truth

There is an important boundary here. A regex can establish local semantic validity:

- the shot looks like a shot identifier;
- the version has the required width;
- the extension is allowed for this template;
- adjacent fields split according to the convention.

It cannot establish relational truth:

- the shot exists in the production database;
- the artist may publish to it;
- this version was reserved;
- the frame range matches the edit;
- the file’s contents agree with its extension.

Those checks belong to higher-level systems.

Trying to encode all production truth into a pathname turns the pathname into a bad database. Ignoring token rules entirely has the opposite problem: any separator-free string becomes equally credible.

The useful middle ground is to let the path layer enforce what it can actually know—grammar and local vocabulary—then hand a well-formed result to systems that understand entities, permissions, and lifecycle.

## Parsing is a claim, not a verdict

I added token rules to [Pathbase](https://rsgalloway.github.io/pathbase/) because path handling often stops one step too early. Extracting fields proves that a string fits a shape. It does not prove that the fields mean what the pipeline thinks they mean.

A robust path system should be able to say:

```text
I recognize this structure.
These tokens satisfy the applicable convention.
Here is what still requires external validation.
```

That is a much stronger result than “the regex matched.”

Because a path that parses is not necessarily valid—and a parser that cannot explain the difference is only guessing with confidence.
