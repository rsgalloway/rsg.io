---
layout: default
title: "I Started With Forkable Websites. The Interesting Part Was the Graph."
date: 2026-09-26
description: "Subfork started as an experiment in forkable websites. Pulling that idea apart eventually exposed something more general underneath: a graph of small, composable pieces that can be forked, connected, and executed independently."
permalink: /blog/i-started-with-forkable-websites/
tags:
  - subfork
  - dags
  - workflows
  - web-development
  - agents
---

[Subfork](https://subfork.com/) started with a fairly literal idea:

**What if a website could be forked?**

Not copied as a zip file. Not cloned from a starter template and then forgotten. Forked more like software: take something that already works, make it yours, change it, and preserve the relationship to where it came from.

The first version of that idea was very website-shaped.

A site had routes. Routes had content and data. It could have a custom domain, authentication, scheduled jobs, and workers. You could branch or fork the site and modify your copy.

That was useful, but over time I kept running into the same question:

> What, exactly, are we forking?

The answer turned out to be smaller than a website.

## The website was the container

Imagine a simple site that publishes a weather dashboard.

At the website level, it looks like one thing:

```text
weather.example.com
```

But the behavior underneath might really be:

```text
fetch weather API
        ↓
normalize JSON
        ↓
select locations
        ↓
generate chart data
        ↓
render HTML
```

The website is just the outer container.

The interesting part is the chain of operations that produces it.

Once I started looking at Subfork that way, the original abstraction felt too coarse. If someone likes the chart transformation but not the website, why should they fork the entire site? If they want the data-normalization step in another project, why should that logic be trapped inside a route?

A route is useful. A website is useful.

But neither is necessarily the smallest reusable thing.

## Forking gets more interesting as the unit gets smaller

Forking a whole website is a big decision.

Forking one useful operation is much cheaper.

Suppose a graph contains:

```text
HTTP request
    ↓
CSV parser
    ↓
filter rows
    ↓
map coordinates
    ↓
render map
```

Maybe I only care about the `CSV parser → filter rows` portion.

Or maybe I want the whole graph, but I want to replace the map with a calendar:

```text
HTTP request
    ↓
CSV parser
    ↓
filter rows
    ↓
convert to events
    ↓
render calendar
```

Now "forking" starts to mean something closer to composition.

I can reuse a node.

I can reuse a subgraph.

I can fork an entire graph.

And the final output might be a website, but it might just as easily be JSON, a file, a report, an image, a scheduled task, or something sent to another system.

That was the conceptual shift for Subfork:

> **The website is one possible output of the graph. It is not the fundamental object.**

## Routes became graphs

The original site model already contained hints of this.

A route is basically:

```text
request
    ↓
some computation
    ↓
response
```

Once the computation becomes explicit, the route can be represented as a graph.

Static content is just a very boring graph:

```text
content → response
```

A dynamic page might be:

```text
request
    ↓
load data
    ↓
transform data
    ↓
template
    ↓
response
```

An API endpoint might end at JSON instead.

A scheduled job might not have an HTTP request or response at all.

The same execution model can describe all of them.

That is much more interesting than building increasingly elaborate special cases for "websites."

## Data stopped being hidden glue

Website frameworks tend to hide data movement inside application code.

One function fetches something. Another function transforms it. A template expects some implicit structure. A cron job runs a script that knows where to put the result.

It works, but the relationships are mostly invisible.

A graph makes them explicit:

```text
[node A] --rows--> [node B] --events--> [node C]
```

Now the edges are part of the model.

That matters because composition requires contracts. If one node emits rows and another accepts rows, they can be connected without either needing to know about the entire application around them.

This also changes what "forking" means.

Forking is no longer just:

> Give me my own copy of this site.

It can mean:

> Give me my own version of this graph, while preserving the pieces I still want to reuse.

That feels much closer to how software actually evolves.

## The DAG became the product

Eventually I realized I was spending more time thinking about the execution graph than the website wrapped around it.

How should nodes declare inputs and outputs?

How do graphs compose?

What does it mean to reference another published graph?

How should a run be represented?

Which parts are deterministic, and which parts can be handled by an agent?

How do you inspect what actually happened?

Those questions apply whether the output is a webpage or not.

So Subfork has been moving downward in abstraction:

```text
website
  ↓
routes + content + data
  ↓
graphs
  ↓
nodes + edges
  ↓
execution
```

Not because websites stopped mattering.

Because exposing the lower layer makes websites just one thing you can build.

## This also changes how AI fits

There is an obvious temptation right now to make the whole graph "agentic."

I think that would throw away one of the useful properties of the DAG.

If a step is deterministic, it should probably stay deterministic:

```text
parse CSV
resize image
fetch URL
write file
```

If a step benefits from judgment, an AI model can be a node:

```text
classify document
summarize feedback
extract structured fields
decide among bounded options
```

The graph can connect both.

That gives the agent somewhere concrete to live without asking it to become the scheduler, state machine, retry system, and application architecture all at once.

The more I work on Subfork, the more I like that division.

## The original idea is still there

The funny part is that Subfork did not really abandon the original idea.

It generalized it.

I still want someone to find something useful, fork it, and make it theirs.

The difference is that "something" no longer has to mean an entire website.

It might be:

```text
a node
a transformation
a subgraph
a workflow
an application
```

And those pieces can themselves be built from other published pieces.

That is a much more granular kind of reuse than copying a finished site.

It also makes the original name make more sense to me.

The interesting part was never the website.

It was the fork.

## Websites are still a good output

I still like the original vision of forkable websites.

A graph that fetches data, transforms it, and renders an interactive page is a compelling thing to fork. So is a dashboard, a map, a calendar, or a small application.

But now those are examples of what the system can produce rather than the boundary of the system itself.

Subfork started as an experiment in making websites forkable.

Pulling that idea apart exposed the more interesting object underneath:

**small pieces of computation that can be composed, connected, forked, and executed as a graph.**

The website is still there.

You can just see the DAG now.
