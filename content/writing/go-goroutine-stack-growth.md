---
title: "How Goroutine Stacks Grow and Shrink"
date: 2025-06-08
description: "Goroutine stacks start at 2KB, double on overflow, and shrink during GC. The mechanics of Go's contiguous stack model."
tags: ["go"]
---

If you ask any mid-senior Go dev what makes goroutines 'lightweight' and you'll get the standard reply:

> They start with **2 KB** of stack instead of 1 MB like OS threads.

They're not wrong. But they're not thinking deep enough.

Go's stack model isn't just a small preallocated buffer; it's **a live, evolving region of memory that resizes in realtime**, grows when needed, and (rarely) shrinks. It's also bounded. Not infinite. Bounded by hard design.

And *none of this* is your typical day-to-day developer concern. Until it is.

---

Let's start simple. Go's runtime gives each new goroutine **2 KB** of stack. That's tiny. But Go doesn't panic when you blow past it - it grows the stack dynamically, by allocating a new region (typically doubling the size) and copying the old stack frames over.

This is a silent, behind-the-scenes act of memory juggling that can happen **dozens or hundreds of times per process**, with no visibility unless you go looking.

Here's the kicker: **each goroutine has an upper stack limit** and it's not documented in bold in any official place.

### The hard upper bound per goroutine? Around 1 GB of stack.

Hit it, and the program **panics immediately**:

```
runtime: goroutine stack exceeds 1000000000-byte limit
fatal error: stack overflow
```

That's not a soft fail. That's a crash.

And it's easier to hit than you think if you're writing recursive algorithms, parsing deeply nested data, or spawning goroutines in hot paths that grow quickly under concurrency.

---

### Stack Growth Lifecycle

Every time a goroutine's stack runs out of space, the runtime silently doubles the allocation and copies everything over. This is the full lifecycle from creation to regrowth.

{{< mermaid >}}
graph LR
    A["New Goroutine\n2 KB stack"] --> B["Function\nCall"]
    B --> C{"Stack\nCheck"}
    C -->|Enough| D["Continue\nExecution"]
    C -->|Overflow| E["Allocate\n2x Stack"]
    E --> F["Copy Old\nFrames"]
    F --> G["Update\nPointers"]
    G --> D

    style A fill:#6366f1,color:#fff,stroke:none
    style C fill:#f59e0b,color:#fff,stroke:none
    style E fill:#10b981,color:#fff,stroke:none
    style F fill:#10b981,color:#fff,stroke:none
    style G fill:#10b981,color:#fff,stroke:none
    style D fill:#64748b,color:#fff,stroke:none
    style B fill:#64748b,color:#fff,stroke:none
{{< /mermaid >}}

---

Let's prove it.

Try this:

```go
package main

func deep(n int) {
    var buf [1024]byte // 1 KB per frame
    buf[0] = byte(n)
    if n > 0 {
        deep(n - 1)
    }
}

func main() {
    deep(4096 * 4096) // Push for 1 GB stack with 16 million calls
}
```

You'll crash. Every call uses 1 KB on the stack. 1M recursive calls = 1 GB.

```bash
> go run main.go

runtime: goroutine stack exceeds 1000000000-byte limit
runtime: sp=0x140201603a0 stack=[0x14020160000, 0x14040160000]
fatal error: stack overflow

runtime stack:
runtime.throw({0x104f9c923?, 0x100000000?})
... and more fluff ...
```

The stack doesn't shrink after this. It doesn't get reused by default. The runtime gives up.

---

Here's something most people don't know: **stack growth triggers memory copy operations.** Every time your goroutine blows past its stack limit, the runtime:

- Allocates a new larger stack
- Copies the existing stack to the new one
- Updates stack pointers and metadata
- Continues execution like nothing happened

This is *not free*. It introduces latency and can increase garbage collection overhead - because stacks contain pointers, and the Go GC must scan every live goroutine stack frame for reachable objects.

{{< callout type="warning" >}}
**The more your stacks grow, the more work your GC has to do.**

Even if those stacks are just frames, if they hold pointers, they're GC roots.
{{< /callout >}}

### Stack Size Progression

Stacks double on each growth event, from the initial 2 KB up to the ~1 GB ceiling. The GC can shrink stacks back down, but only under specific conditions.

{{< mermaid >}}
graph TD
    S1["2 KB\n(initial)"] --> S2["4 KB"]
    S2 --> S3["8 KB"]
    S3 --> S4["16 KB"]
    S4 --> S5["32 KB"]
    S5 --> S6["..."]
    S6 --> S7["~1 GB\n(ceiling)"]

    S7 -.->|"GC shrink\n(if idle + mostly unused)"| S5
    S5 -.->|"GC shrink"| S3

    style S1 fill:#10b981,color:#fff,stroke:none
    style S2 fill:#10b981,color:#fff,stroke:none
    style S3 fill:#6366f1,color:#fff,stroke:none
    style S4 fill:#6366f1,color:#fff,stroke:none
    style S5 fill:#f59e0b,color:#fff,stroke:none
    style S6 fill:#f59e0b,color:#fff,stroke:none
    style S7 fill:#ef4444,color:#fff,stroke:none
{{< /mermaid >}}

---

A goroutine with a **2 KB** stack is cheap.

A goroutine that grows to **512 KB**, holds references to large objects, and lives long enough to survive multiple GC cycles? That's not cheap anymore. That's stealth memory overhead.

Let's look at this example:

```go
package main

import (
    "time"
)

func holdMemory(n int) {
    var data [128 * 1024]byte // 128 KB
    data[0] = 1
    time.Sleep(10 * time.Second) // Keep goroutine alive
}

func main() {
    for i := 0; i < 1000; i++ {
        go holdMemory(i)
    }
    time.Sleep(30 * time.Second)
}
```

You just spawned **1000** goroutines, each holding at least 128 KB on stack. That's **128 MB** of live stack memory **not counted in your heap**, but scanned by GC. And it only gets worse under load.

---

Now the part nobody talks about: **stack shrinking.**

Yes, Go does shrink goroutine stacks, **but only during garbage collection**, and only if:

- The goroutine is idle
- The stack is mostly unused
- The shrink won't cause immediate regrowth

In other words: *don't count on it.* Go is conservative with stack shrinkage. This means a burst of high-memory goroutines can bloat your memory profile **long after the work is done**, unless the GC kicks in and decides to do housecleaning - which it might not.

Want to observe it?

You can't. There is no public runtime metric for per-goroutine stack usage. You can't pprof it directly unless you attach custom logic. You can't even tell if a goroutine stack has been shrunk unless you look into a trace.

---

### Contiguous Stack Copy

When a stack outgrows its current allocation, Go allocates a new contiguous block at double the size, copies all frames, and adjusts every internal pointer. The old stack is then freed.

{{< mermaid >}}
graph LR
    subgraph "Old Stack (4 KB)"
        O1["Frame 1"]
        O2["Frame 2"]
        O3["Pointer A\n→ Frame 1"]
    end

    subgraph "New Stack (8 KB)"
        N1["Frame 1\n(copied)"]
        N2["Frame 2\n(copied)"]
        N3["Pointer A'\n→ Frame 1\n(adjusted)"]
        N4["Free Space"]
    end

    O1 -->|copy| N1
    O2 -->|copy| N2
    O3 -->|"adjust + copy"| N3

    style O1 fill:#64748b,color:#fff,stroke:none
    style O2 fill:#64748b,color:#fff,stroke:none
    style O3 fill:#f59e0b,color:#fff,stroke:none
    style N1 fill:#6366f1,color:#fff,stroke:none
    style N2 fill:#6366f1,color:#fff,stroke:none
    style N3 fill:#10b981,color:#fff,stroke:none
    style N4 fill:none,stroke:#6366f1,stroke-dasharray:5
{{< /mermaid >}}

---

Want to go deeper? Try this:

```go
package main

import (
    "fmt"
    "runtime"
)

func recurse(n int) {
    var buf [1024]byte
    buf[0] = byte(n)
    if n > 0 {
        recurse(n - 1)
    }
}

func main() {
    var m runtime.MemStats
    runtime.ReadMemStats(&m)
    fmt.Println("Before:", m.StackInuse)

    recurse(1000)

    runtime.ReadMemStats(&m)
    fmt.Println("After:", m.StackInuse)
}
```

It prints stack usage in bytes before and after a deep recursion.

```bash
> go run main.go

Before: 262144
After: 294912
```

You'll see how the memory gets allocated, but never explicitly freed.

---

Let's hit one more unexplored angle: **stack growth can trigger GC pressure even without heap allocations.**

If you think your service has no memory leak because you aren't allocating on the heap, you're missing the point. A runaway stack holds pointers. Those pointers get scanned. That means GC is invoked **more often**, or **takes longer**, even if you aren't growing the heap.

This is how your **5ms** p99 turns into **100ms** not from bad code, but from unseen stack behavior.

---

There's no tuning knob for stack size.

No config.

No CLI flag to control initial stack size, max size, or shrink behavior.

The only way to manage it is **through code discipline**:

- Avoid recursive goroutines unless they terminate quickly
- Don't hold large structs or pointers deep in call graphs
- Be aware of implicit stack use via function calls
- Never assume goroutines are 'free'. Inspect their memory impact
- Use `GODEBUG=efence=1` to crash fast and find limits

---

You don't need to memorize internals. But you **do need to understand the consequences**.

Most devs won't talk about this. Few don't know either.

But now you do.

And if you write systems that scale, this will hit you eventually.

Better to learn it now while your stack's still small.
