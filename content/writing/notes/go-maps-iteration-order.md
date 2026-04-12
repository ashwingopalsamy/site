---
title: "Go Maps Iteration Order"
date: 2025-12-25
tags: ["go-internals"]
url: /writing/notes/go-maps-iteration-order/
---

I was working on a minimal word counter. Read from stdin, normalize the input, increment the value for the keys in a `map[string]int` each time a value is observed.

Irrespective of the order of the input data for a very small unit test-case I created, the output looked sorted. Alphabetically sorted. Clean. Predictable.

I ran it again. Same order. Added more input. Digits. Letters. Mixed tokens.

At that point, my instincts kicked in. **Go maps are unordered.** I knew that. So why was the output behaving so politely?

## The non-negotiable fact

Go maps do **not** guarantee iteration order. Ever.

The language spec is explicit. Iteration order is not specified and must not be relied upon.

So if the output looks sorted, that is never by intention. It might be an accident. The interesting part is understanding *why this accident looks so consistent*.

## What is actually happening inside a Go map

A Go map is a **hash table**. Iteration walks buckets in a runtime-defined sequence, not key order.

**Important detail:** iteration does **not** mean "pick a random key each time" but rather "walk internal memory structures in a sequence". This distinction explains everything I had observed.

{{< mermaid >}}
graph LR
    subgraph "Hash Function"
        H["hash(key)"]
    end
    K1["a"] --> H
    K2["b"] --> H
    K3["m"] --> H
    K4["1"] --> H
    H --> B0["Bucket 0<br/>1"]
    H --> B1["Bucket 1<br/>2"]
    H --> B3["Bucket 3<br/>a"]
    H --> B4["Bucket 4<br/>b"]
    H --> B6["Bucket 6<br/>m"]
    style H fill:#6366f1,color:#fff,stroke:none
    style B0 fill:#10b981,color:#fff,stroke:none
    style B1 fill:#10b981,color:#fff,stroke:none
    style B3 fill:#10b981,color:#fff,stroke:none
    style B4 fill:#10b981,color:#fff,stroke:none
    style B6 fill:#10b981,color:#fff,stroke:none
{{< /mermaid >}}

## Why the output looked sorted

The experiment had a very specific shape:

- Small number of keys
- Short ASCII strings
- No map resizing during insertion

Under these conditions, hash values distribute nicely across buckets, and buckets are laid out in memory in a way that often correlates with lexical order.

Not because Go sorts anything. Because the bucket layout ends up looking sorted *by coincidence*.

> Unspecified order can still be stable and repeatable.

## A simplified mental model

This is **not** how Go maps are implemented exactly, but it explains the behavior well enough:

```
Input keys:  a   b   m   x   y   z   1   2   9

Hashing step:
a -> bucket 3    x -> bucket 9
b -> bucket 4    y -> bucket 10
m -> bucket 6    z -> bucket 11
1 -> bucket 0    2 -> bucket 1    9 -> bucket 2

Buckets in memory order:
[0] [1] [2] [3] [4] [5] [6] [7] [8] [9] [10] [11]
 1   2   9   a   b       m           x    y    z

Iteration walks buckets left to right:
1 2 9 a b m x y z
```

Digits first. Then letters. Within each group, alphabetical-looking order. No sorting happened. Iteration just walked buckets in memory order.

Change the input distribution, force collisions, trigger a map resize, or run on a different Go version, and this illusion will break instantly.

{{< mermaid >}}
graph TD
    S["Small ASCII key set"]
    L["Large / diverse key set"]
    S --> |"hash values spread<br/>neatly across buckets"| O1["Appears sorted<br/>(coincidence)"]
    L --> |"collisions, resizing,<br/>overflow buckets"| O2["Visibly unordered<br/>(reality)"]
    style S fill:#f59e0b,color:#fff,stroke:none
    style L fill:#10b981,color:#fff,stroke:none
    style O1 fill:#ef4444,color:#fff,stroke:none
    style O2 fill:#10b981,color:#fff,stroke:none
{{< /mermaid >}}

## Why the order kept changing as you inserted new keys

When you print the map after each insertion, you see the output "reorder itself." That was not reordering. What happened was:

- A new key landed in an earlier bucket
- Iteration still walked buckets from the start
- The newly populated bucket now appeared earlier in output

This is why adding `"0"` suddenly made it appear before `"1"` through `"z"`.

## We can't really inspect map internals

Go does not allow reliable inspection of map internals. The language specification does not define the memory layout of maps at all. Bucket structure, hash seeds, overflow handling and growth strategy live entirely inside the runtime and are treated as implementation details. They are free to change between Go versions, and they do.

On top of that, map elements are allowed to move in memory when the map grows. This is why Go explicitly disallows taking the address of a map element. Any address you observe today could become invalid tomorrow, even within the same program execution.

As Keith Randall explains in his deep dive into Go maps, this movement happens incrementally during normal map operations, which makes layout and addresses fundamentally unstable by design.

{{< youtube "Tl7mi9QmLns" >}}

You can technically poke around using `unsafe`, but that immediately ties your understanding to a specific Go version and runtime implementation. It is educational at best and misleading at worst.

{{< callout type="insight" >}}
Deterministic-looking behavior does not imply guarantees. This is a perfect, low-stakes example of that lesson.
{{< /callout >}}
