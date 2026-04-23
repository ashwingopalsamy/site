---
title: "What Happens Before main() in Go"
date: 2024-12-13
description: "Package initialization order, init() functions, dependency ordering, and what the runtime does before your code runs."
tags: ["go"]
---

When we first start with Go, the `main` function seems almost too simple. A single entry point, a straightforward `go run main.go` and voila -- our program is up and running.

But as we dig deeper, there's a subtle, well-thought-out process churning behind the curtain. Before `main` even begins, the Go runtime orchestrates a careful initialization of all imported packages, runs their `init` functions and ensures that everything's in the right order -- no messy surprises allowed.

The way Go arranges this has neat details to it that every Go developer should be aware of, as this influences how we structure our code, handle shared resources and even communicate errors back to the system.

Let's explore some common scenarios and questions that highlight what's really going on before and after `main` kicks into gear.

---

### Program Startup Sequence

Before your code runs a single line, the Go runtime has already done significant work. Here's the full sequence from binary execution to your first `fmt.Println`.

{{< mermaid >}}
sequenceDiagram
    participant OS
    participant Runtime
    participant Packages
    participant main

    OS->>Runtime: Execute binary
    Runtime->>Runtime: Bootstrap (scheduler, GC, memory)
    Runtime->>Packages: Init packages in dependency order
    Packages->>Packages: Run init() functions
    Packages-->>Runtime: All packages initialized
    Runtime->>main: Call main()
    main->>main: Main goroutine runs
    main-->>OS: os.Exit or return
{{< /mermaid >}}

---

## Before main: Orderly Initialization and the Role of init

Picture this: you've got multiple packages, each with their own `init` functions. Maybe one of them configures a database connection, another sets up some logging defaults and a third initializes a lambda worker, with a fourth initializing an SQS queue listener.

By the time `main` runs, you want everything ready -- no half-initialized states or last-minute surprises.

**Example: Multiple Packages and init Order**

```go
// db.go
package db

import "fmt"

func init() {
    fmt.Println("db: connecting to the database...")
    // Imagine a real connection here
}

// cache.go
package cache

import "fmt"

func init() {
    fmt.Println("cache: warming up the cache...")
    // Imagine setting up a cache here
}

// main.go
package main

import (
    _ "app/db"   // blank import for side effects
    _ "app/cache"
    "fmt"
)

func main() {
    fmt.Println("main: starting main logic now!")
}
```

When you run this program, you'll see:

```
db: connecting to the database...
cache: warming up the cache...
main: starting main logic now!
```

The database initializes first (since `main` imports `db`), then the cache and finally `main` prints its message. Go guarantees that all imported packages are initialized before `main` runs. This dependency-driven order is key. If `cache` depended on `db`, you'd be sure `db` finished its setup before `cache`'s `init` ran.

{{< callout type="insight" >}}
Go initializes packages in **dependency order**, not import order. If `cache` imports `db`, then `db` will always initialize first regardless of how the imports are listed in `main.go`.
{{< /callout >}}

### Ensuring a Specific Initialization Order

Now, what if you absolutely need `db` initialized before `cache`, or vice versa?

The natural approach is to ensure `cache` depends on `db` or is imported after `db` in `main`. Go initializes packages in the order of their dependencies, not the order of imports listed in `main.go`.

A trick that we use is a blank import: `_ "path/to/package"` -- to force initialization of a particular package. But I wouldn't rely on blank imports as a primary method; it can make dependencies less clear and lead to maintenance headaches.

Instead, consider structuring packages so their initialization order emerges naturally from their dependencies. If that's not possible, maybe the initialization logic shouldn't rely on strict sequencing at compile time. You could, for instance, have `cache` check if `db` is ready at runtime, using a `sync.Once` or a similar pattern.

### Package Dependency Ordering

Here's how Go resolves initialization order across a dependency graph. The key insight: leaf packages (those with no further imports) initialize first, and it works its way up to `main`.

{{< mermaid >}}
graph TD
    main["main\n(init last)"]
    A["Package A"]
    B["Package B"]
    C["Package C"]

    main --> A
    main --> B
    A --> C

    style C fill:#374151,color:#fff,stroke:none
    style A fill:#374151,color:#fff,stroke:none
    style B fill:#6366f1,color:#fff,stroke:none
    style main fill:#64748b,color:#fff,stroke:none
{{< /mermaid >}}

**Init order: C -> A -> B -> main.** C has no dependencies, so it initializes first. A depends on C, so it goes next. B has no unmet dependencies at that point. main is always last.

---

### Avoiding Circular Dependencies

Circular dependencies at the initialization level are a big no-no in Go. If package **A** imports **B** and **B** tries to import **A**, you've just created a circular dependency.

Go will refuse to compile, saving you from a world of confusing runtime issues. This might feel strict, but trust me, it's better to find these problems early rather than debugging weird initialization states at runtime.

---

### Dealing with Shared Resources and sync.Once

Imagine a scenario where packages **A** and **B** both depend on a shared resource -- maybe a configuration file or a global settings object. Both have `init` functions and both try to initialize that resource. How do you ensure the resource is only initialized once?

A common solution is to place the shared resource initialization behind a `sync.Once` call. This ensures that the initialization code runs exactly one time, even if multiple packages trigger it.

**Example: Ensuring Single Initialization**

```go
// config.go
package config

import (
    "fmt"
    "sync"
)

var (
    once      sync.Once
    someValue string
)

func init() {
    once.Do(func() {
        fmt.Println("config: initializing shared resource...")
        someValue = "initialized"
    })
}

func Value() string {
    return someValue
}
```

Now, no matter how many packages import `config`, the initialization of `someValue` happens only once. If package A and B both rely on `config.Value()`, they'll both see a properly initialized value.

{{< callout type="tip" >}}
Use `sync.Once` when you need lazy or guarded initialization of shared resources. It's safer than relying on `init()` ordering for cross-package resource setup.
{{< /callout >}}

### Choosing Between init and sync.Once

Not sure which to reach for? Here's a quick decision guide.

{{< mermaid >}}
graph LR
    Q{"What kind of\ninitialization?"}
    A["Must happen\nat import time"]
    B["Can be deferred\n(lazy init)"]
    C["Need both"]

    R1["Use init()"]
    R2["Use sync.Once"]
    R3["init() for must-have\nsync.Once for expensive/optional"]

    Q --> A --> R1
    Q --> B --> R2
    Q --> C --> R3

    style R1 fill:#374151,color:#fff,stroke:none
    style R2 fill:#6366f1,color:#fff,stroke:none
    style R3 fill:#f59e0b,color:#fff,stroke:none
    style Q fill:#64748b,color:#fff,stroke:none
    style A fill:#64748b,color:#fff,stroke:none
    style B fill:#64748b,color:#fff,stroke:none
    style C fill:#64748b,color:#fff,stroke:none
{{< /mermaid >}}

---

### Multiple init Functions in a Single File or Package

You can have multiple `init` functions in the same file and they'll run in the order they appear. Across multiple files in the same package, Go runs `init` functions in a consistent, but not strictly defined order. The compiler might process files in alphabetical order, but you shouldn't rely on that. If your code depends on a specific sequence of `init` functions within the same package, that's often a sign to refactor. Keep `init` logic minimal and avoid tight coupling.

**Legitimate Uses vs. Anti-Patterns**

`init` functions are best used for simple setup: registering database drivers, initializing command-line flags or setting up a logger. Complex logic, long-running I/O or code that might panic without good reason are better handled elsewhere.

> As a rule of thumb, if you find yourself writing a lot of logic in `init`, you might consider making that logic explicit in `main`.

---

### Exiting with Grace and Understanding os.Exit()

Go's `main` doesn't return a value. If you want to signal an error to the outside world, `os.Exit()` is your friend. But keep in mind: calling `os.Exit()` terminates the program immediately.

{{< callout type="warning" >}}
`os.Exit()` terminates the program immediately. **No deferred functions run**, no `panic` stack traces print. Always perform cleanup explicitly before calling `os.Exit()`.
{{< /callout >}}

**Example: Cleanup Before Exit**

```go
package main

import (
    "fmt"
    "os"
)

func main() {
    if err := doSomethingRisky(); err != nil {
        fmt.Println("Error occurred, performing cleanup...")
        cleanup()       // Make sure to clean up before calling os.Exit
        os.Exit(1)
    }
    fmt.Println("Everything went fine!")
}

func doSomethingRisky() error {
    // Pretend something failed
    return fmt.Errorf("something bad happened")
}

func cleanup() {
    // Close files, databases, flush buffers, etc.
    fmt.Println("Cleanup done!")
}
```

If you skip the cleanup call and jump straight to `os.Exit(1)`, you lose the chance to clean up resources gracefully.

#### Other Ways to End a Program

You can also end a program through a `panic`. A `panic` that's not recovered by `recover()` in a deferred function will crash the program and print a stack trace. This is handy for debugging but not ideal for normal error signaling. Unlike `os.Exit()`, a `panic` gives deferred functions a chance to run before the program ends, which can help with cleanup, but it also might look less tidy to end-users or scripts expecting a clean exit code.

Signals (like `SIGINT` from Cmd+C) can also terminate the program. If you're thorough, you can catch signals and handle them gracefully.

---

## Runtime, Concurrency and the main Goroutine

Initialization happens before any goroutines are launched, ensuring no race conditions at startup. Once `main` begins, however, you can spin up as many goroutines as you like.

> **It's important to note that the `main` function itself runs in a special "main goroutine" started by the Go runtime. If `main` returns, the entire program exits -- even if other goroutines are still doing work.**

This is a common gotcha: just because you started background goroutines doesn't mean they keep the program alive. Once main finishes, everything shuts down.

```go
package main

import (
    "fmt"
    "time"
)

func main() {
    go func() {
        time.Sleep(2 * time.Second)
        fmt.Println("Goroutine finished its job!")
    }()

    // If we simply return here, the main goroutine finishes,
    // and the program exits immediately, never printing the above message.

    time.Sleep(3 * time.Second)
    fmt.Println("Main is done, exiting now!")
}
```

In this example, the goroutine prints its message only because `main` waits 3 seconds before ending. If `main` ended sooner, the program would terminate before the goroutine completed. The runtime doesn't "wait around" for other goroutines when `main` exits.

If your logic demands waiting for certain tasks to complete, consider using synchronization primitives like `WaitGroup` or channels to signal when background work is done.

### What if a Panic Occurs During Initialization?

If a panic happens during `init`, the whole program terminates. No `main`, no recovery opportunity. You'll see a panic message that can help you debug. This is one reason to keep `init` functions simple, predictable and free of complex logic that might blow up unexpectedly.

---

## Wrapping It Up

By the time `main` runs, Go has already done a ton of invisible legwork: it's initialized all your packages, run every `init` function and checked that there are no nasty circular dependencies lurking around. Understanding this process gives you more control and confidence in your application's startup sequence.

When something goes wrong, you know how to exit cleanly and what happens to deferred functions. When your code grows more complex, you know how to enforce initialization order without resorting to hacks. And if concurrency comes into play, you know that the race conditions start after `init` runs, not before.

These little insights make Go's seemingly simple `main` function feel like the tip of an iceberg. If you have your own tricks, pitfalls you've stumbled into, or questions about these internals, I'd love to hear them.

After all, we're all still learning -- and that's half the fun of being a Go developer.
