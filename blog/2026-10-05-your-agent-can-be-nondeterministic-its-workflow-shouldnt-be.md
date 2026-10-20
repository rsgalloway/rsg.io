---
layout: article
title: "Your Agent Can Be Nondeterministic. Its Workflow Shouldn't Be."
date: 2026-10-05
description: "LLM output may vary from run to run. That does not excuse workflows that cannot explain what ran, what changed, or where a result came from."
permalink: /blog/your-agent-can-be-nondeterministic-its-workflow-shouldnt-be/
tags: [ai, agents, workflows, reproducibility, subfork]
---

# Your Agent Can Be Nondeterministic. Its Workflow Shouldn't Be.

Ask the same language model the same question twice and you may get two different answers.

That is expected.

Run the same agent workflow twice and discover that it used a different prompt, called different tools, read mutable inputs, retried half the steps, overwrote an artifact, and cannot explain which of those things changed.

That is not “AI being nondeterministic.” That is a workflow with no identity.

The useful goal is not to force stochastic components to emit identical bytes. It is to build a **deterministic envelope** around them: make the structure, inputs, dependencies, side effects, and recorded outputs precise enough that the remaining uncertainty is visible and intentional.

## Determinism is not one switch

People often treat reproducibility as binary: either a run produces exactly the same output or it does not.

That model is too crude for agent systems. There are several different questions hiding inside it:

- Did we execute the same graph?
- Did each node receive the same inputs?
- Did we use the same prompt, model, tool, and configuration?
- Did external data change between runs?
- Did a retry repeat a side effect?
- Are we comparing newly generated output or a recorded artifact?

A model response may remain variable even when the first three answers are yes. But that is a much better kind of variability. We have isolated it to the component that is actually stochastic.

Without that envelope, every difference gets blamed on the model. The workflow becomes epistemically useless: it cannot tell us whether the model changed its mind or the system quietly changed the question.

## Replay, rerun, and fork are different operations

Agent tools frequently blur three distinct actions.

A **replay** should return the recorded events and artifacts from an existing execution. It does not ask the model again. It answers: *what happened?*

A **rerun** should execute the same workflow definition against the same identified inputs and dependencies. Stochastic nodes may produce different results. It answers: *what happens if we try that exact setup again?*

A **fork** intentionally changes something—a prompt, input, model, branch, parameter, or node—and creates a new lineage. It answers: *what happens if we vary this?*

Those semantics matter. If clicking “run again” silently picks up the latest prompt and current web data, it is not a rerun. It is an untracked fork.

If opening an old result calls the model again, it is not a replay. It is a new execution wearing the old execution’s name.

The distinction gives us a useful data model:

```text
replay = same execution, recorded outputs
rerun  = same definition + same identified inputs, new execution
fork   = derived definition or inputs, new lineage
```

Now variation has somewhere to live.

## Freeze coordinates, not the world

Perfect reproducibility is impossible once a workflow touches the outside world. Websites change. APIs return current state. Models are updated behind stable product names. Time itself may be an input.

The answer is not to pretend those dependencies are fixed. It is to record the coordinates used by the run.

For a useful execution record, I want to know:

```text
workflow revision
node revisions
input artifact identities
prompt and configuration revisions
model and tool identifiers
external observations
output artifact identities
```

An HTTP response does not have to remain available forever, but the result consumed by a consequential run should be captured or identified. “Fetched the weather” is weak provenance. “Node 4 consumed this response at this time” is useful provenance.

Likewise, `model=latest` may be a reasonable live policy, but the execution record should resolve it to whatever actually ran. A moving reference is convenient before execution. It is not sufficient history afterward.

This is the same reason build systems record dependency versions and media pipelines distinguish a publish from a path. Reproducibility does not require freezing the universe. It requires preserving the coordinates of the observation.

## Side effects are where ambiguity becomes damage

Variable prose is annoying. Variable side effects are dangerous.

Suppose an agent generates an invoice, sends an email, updates a ticket, or publishes a file. A node times out after the remote service accepts the request, so the workflow retries it. Did the first attempt fail, or did the acknowledgement fail?

If the workflow treats those as equivalent, “nondeterminism” becomes duplicate email, duplicate charges, or conflicting publishes.

The deterministic envelope therefore needs to distinguish computation from effects. A retry can safely regenerate a draft. Repeating an external action requires an identity, a recorded outcome, and often an idempotency boundary.

This does not make the whole system deterministic. It makes uncertainty explicit at the point where it matters.

## A graph is more than a way to draw boxes

Visual graph editors are often treated as friendlier syntax for code. Their more important property is that they can make execution structure addressable.

When a workflow is an explicit graph, we can ask:

- Which node introduced this artifact?
- Which upstream value changed?
- Was this branch skipped or did it fail?
- Which subgraph was referenced by this execution?
- Can I fork the workflow from this exact point?

Those questions are difficult when the workflow exists only as a chat transcript and a mutable pile of tool calls. The transcript tells a story. The graph describes a computation.

That is a large part of why I am building [Subfork](https://subfork.com/) around explicit, forkable graphs. The interesting unit is not just the final answer. It is the structure that produced it: something you can inspect, run, reuse, and deliberately vary instead of losing it inside one opaque session.

## Make the uncertainty local

AI systems will not become trustworthy because every model call suddenly becomes deterministic.

They will become more trustworthy when a different answer no longer implies a mysterious run.

Keep the workflow definition identifiable. Record the inputs actually consumed. Preserve the artifacts produced. Separate replay from rerun, and rerun from fork. Put boundaries around side effects. Resolve moving references into execution history.

Then let the model be stochastic.

The goal is not identical output at any cost.

The goal is to know exactly where the difference came from.
