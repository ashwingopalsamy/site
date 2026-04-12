---
title: "Go Scheduler, Yield Points, and Infinite Loops"
date: 2025-05-24
description: "When to use for{} vs goroutines, how the GMP scheduler cooperatively preempts, and why async preemption exists."
tags: ["go-internals"]
---

I've been reviewing some performance-critical code lately, and I keep coming back to this pattern:

```go
for {
    // tight polling loop
    if condition {
        break
    }
}
```

versus

```go
go func() {
    for {
        // background processing
    }
}()
```

On the surface, these look similar, both use infinite loops. But the runtime implications are fascinating, and I think we don't talk about this enough.

## The performance rabbit hole

Here's what got me thinking. I was optimizing a real-time data processor that needed sub-millisecond response times. The naive approach was throwing everything into goroutines:

```go
go func() {
    for {
        data := <-inputChan
        process(data)
        outputChan <- result
    }
}()
```

Standard Go idiom, right? But the scheduler overhead was killing us. Context switches, goroutine parking/unparking. All tiny costs that add up when you're processing millions of events per second.

The solution? Sometimes a plain `for {}` in the main goroutine actually performs better:

```go
func main() {
    for {
        select {
        case data := <-inputChan:
            process(data)
            outputChan <- result
        default:
            // yield briefly to scheduler
            runtime.Gosched()
        }
    }
}
```

No goroutine overhead. No scheduler interference. Just raw, tight loop performance when you need it.

## When Goroutines can become overhead

This isn't about goroutines being bad. They're one of Go's best features. But like any abstraction, they have costs. For most applications, those costs are negligible. For some applications, they matter.

I've seen codebases where developers reflexively wrap every loop in a goroutine because *"concurrency is good"*. But if you're not actually doing concurrent work, you're just adding overhead:

```go
// Unnecessary overhead
go func() {
    for i := 0; i < len(data); i++ {
        process(data[i])  // sequential work anyway
    }
}()

// Just do the work
for i := 0; i < len(data); i++ {
    process(data[i])
}
```

The goroutine version doesn't make this faster. It makes it slower. You've added scheduling overhead for no concurrent benefit.

## How the Go Scheduler Changes Everything

To understand why this choice matters, you need to know how Go's scheduler actually works. It's not just theory, this directly impacts your performance profile.

Go uses an **M:N** scheduler where **M** goroutines are multiplexed onto **N** OS threads. The key insight is that goroutines are cooperatively scheduled, not preemptively. They yield control at specific points:

- Channel operations
- System calls
- Memory allocator calls
- Explicit `runtime.Gosched()` calls
- Function calls (since Go 1.14, thanks to async preemption)

Here's the critical difference: a tight `for {}` loop without any of these yield points will monopolize its OS thread until the scheduler's async preemption kicks in *(roughly every 10ms)*.

Sometimes that's exactly what you want. An uninterrupted CPU time for hot loops.

But when you wrap that same loop in a goroutine, it competes with other goroutines for scheduling time. Each time the scheduler runs (which happens frequently), there's overhead:

```go
// This might get preempted constantly
go func() {
    for {
        // tight computation
        result := expensiveCalculation()
        if result > threshold {
            break
        }
    }
}()

// This runs uninterrupted until natural yield points
for {
    result := expensiveCalculation()
    if result > threshold {
        break
    }
}
```

The scheduler overhead includes context switching, stack management, and the coordination between the scheduler and your goroutines. For most code, this is negligible. For tight loops processing millions of operations, it's measurable.

## The GMP Model in Practice

Go's scheduler uses a **GMP** model: Goroutines (**G**) run on Machine threads (**M**) via Processors (**P**). Each **P** has a local run queue of goroutines, plus there's a global run queue. When you create a goroutine, it gets queued for scheduling.

{{< mermaid >}}
graph TD
    subgraph "Global Run Queue"
        GQ["G5, G6, G7 ..."]
    end

    subgraph "P0 (Processor)"
        LQ0["Local Queue:\nG1, G2"]
        LQ0 --> M0["M0\n(OS Thread)"]
        M0 --> CPU0["CPU Core 0"]
    end

    subgraph "P1 (Processor)"
        LQ1["Local Queue:\nG3, G4"]
        LQ1 --> M1["M1\n(OS Thread)"]
        M1 --> CPU1["CPU Core 1"]
    end

    GQ -.->|"schedule"| LQ0
    GQ -.->|"schedule"| LQ1
    LQ0 -.->|"work steal"| LQ1

    style GQ fill:#64748b,color:#fff,stroke:none
    style LQ0 fill:#6366f1,color:#fff,stroke:none
    style LQ1 fill:#6366f1,color:#fff,stroke:none
    style M0 fill:#f59e0b,color:#fff,stroke:none
    style M1 fill:#f59e0b,color:#fff,stroke:none
    style CPU0 fill:#10b981,color:#fff,stroke:none
    style CPU1 fill:#10b981,color:#fff,stroke:none
{{< /mermaid >}}

The scheduler's work-stealing algorithm means goroutines can migrate between threads, which adds coordination overhead. For a single hot loop that doesn't need concurrency, this is pure cost with no benefit.

I've started thinking about this choice through the lens of scheduler pressure:

- **High-frequency tight loops**: Run on main goroutine to avoid scheduling overhead
- **Background/periodic work**: Use goroutines for natural yielding and fairness
- **I/O bound operations**: Definitely goroutines (blocking syscalls trigger scheduler naturally)
- **CPU-bound work that can be parallelized**: Multiple goroutines, but be mindful of coordination costs

### Cooperative Scheduling

Under cooperative scheduling, a goroutine holds the processor until it voluntarily yields at a known yield point, like a channel operation or a function call.

{{< mermaid >}}
sequenceDiagram
    participant S as Scheduler
    participant A as Goroutine A
    participant B as Goroutine B

    S->>A: Schedule on P0
    activate A
    Note over A: Executing...
    A->>A: Channel send (yield point)
    A->>S: Yield control
    deactivate A
    S->>B: Schedule on P0
    activate B
    Note over B: Executing...
    B->>B: runtime.Gosched()
    B->>S: Yield control
    deactivate B
    S->>A: Re-schedule on P0
    activate A
    Note over A: Resumes execution
    deactivate A
{{< /mermaid >}}

### Async Preemption

But what about goroutines that never yield? Since Go 1.14, the `sysmon` background thread detects goroutines running longer than ~10ms and forces preemption via a SIGURG signal.

{{< mermaid >}}
sequenceDiagram
    participant SM as sysmon
    participant G as Goroutine (tight loop)
    participant S as Scheduler
    participant G2 as Next Goroutine

    G->>G: Running for >10ms (no yield points)
    SM->>SM: Detects long-running G
    SM->>G: Send SIGURG
    Note over G: Signal handler fires,\nsaves state, marks preemptible
    G->>S: Suspended
    S->>G2: Schedule next goroutine
    activate G2
    Note over G2: Executing...
    deactivate G2
    S->>G: Re-schedule eventually
{{< /mermaid >}}

## Real-World Patterns

In practice, I see three main patterns where this distinction matters:

**1. Event loops in performance-critical paths:**

```go
// Main processing thread
for {
    select {
    case event := <-events:
        handleCriticalPath(event)
    case <-shutdown:
        return
    }
}
```

**2. Background workers:**

```go
// Background cleanup, metrics, etc.
go func() {
    ticker := time.NewTicker(time.Minute)
    defer ticker.Stop()
    for {
        select {
        case <-ticker.C:
            cleanup()
        case <-ctx.Done():
            return
        }
    }
}()
```

**3. Hybrid approaches:**

```go
// Main thread handles hot path
go backgroundWorker()  // Cold path in goroutine

for {
    select {
    case urgent := <-urgentChan:
        handleUrgent(urgent)  // Zero-copy, minimal overhead
    case routine := <-routineChan:
        routineWorkChan <- routine  // Delegate to background
    }
}
```

## Choosing the Right Pattern

The decision between a plain loop and a goroutine comes down to what you're optimizing for. This decision tree captures the key branching points.

{{< mermaid >}}
graph LR
    A{"Need\nconcurrency?"}
    A -->|No| B["for {} loop\n(direct execution)"]
    A -->|Yes| C{"Bounded\nwork?"}
    C -->|Yes| D["Worker Pool\n(fixed goroutines)"]
    C -->|No| E{"I/O or\nCPU bound?"}
    E -->|I/O| F["Goroutine per task\n(scheduler handles blocking)"]
    E -->|CPU| G["select {} loop\n(controlled yielding)"]

    style A fill:#6366f1,color:#fff,stroke:none
    style B fill:#10b981,color:#fff,stroke:none
    style C fill:#f59e0b,color:#fff,stroke:none
    style D fill:#10b981,color:#fff,stroke:none
    style E fill:#f59e0b,color:#fff,stroke:none
    style F fill:#10b981,color:#fff,stroke:none
    style G fill:#10b981,color:#fff,stroke:none
{{< /mermaid >}}

## The nuance most don't talk about

The real insight isn't *"loops vs goroutines"*. It's understanding when the scheduler helps you and when it gets in your way. Most Go education focuses on the happy path where goroutines solve everything. But production systems often need more surgical approaches.

I've seen systems gain 30% throughput just by moving one critical loop out of a goroutine. I've also seen systems become unresponsive because someone removed goroutines that were providing necessary yielding points.

The trick is knowing which scenario you're in.

## When this actually matters?

To be clear, this level of optimization matters for maybe 5% of Go applications. If you're building typical web services, CRUD apps, or data pipelines, just use goroutines everywhere and call it a day. The scheduler overhead is negligible compared to I/O, database calls, and network latency.

But if you're **building at scale**, then these micro-optimizations can make the difference between meeting your SLAs and missing them.

## The takeaway

Go's runtime gives you both tools for a reason. Goroutines for most things, plain loops when you need maximum control. The art is recognizing which is which.

It's not about being clever. It's about understanding your performance profile and choosing the right abstraction for the job.
