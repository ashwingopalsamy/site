---
title: "Go Was Never Bad"
date: 2025-06-21
description: "The common criticisms of Go were always overstated. Generics arrived, error handling is fine, and simplicity was always the point."
tags: ["go"]
---

Every time I see that GitHub repo [go-is-not-good](https://github.com/ksimka/go-is-not-good) making the rounds again, I laugh.

It's always shared by people who mistake language cleverness for engineering. People who still think Go was meant to impress programming language theorists.

Let me say this clearly: **Go is not for everything.** It was never meant to be.

But if you're building cloud-native systems, if you're working with distributed architecture, if you're running services in production that actually matter -- **Go is brutal, minimal, and effective.**

And if you still think it's "not good," you're probably the one who doesn't get it.

{{< mermaid >}}
graph LR
    A["No generics"] -- "Go 1.18" --> B["Resolved"]
    C["No modules"] -- "Go 1.11" --> D["Resolved"]
    E["Error handling"] --> F["By Design"]
    G["Concurrency"] --> H["Same as every lang"]

    style B fill:#374151,color:#fff,stroke:none
    style D fill:#374151,color:#fff,stroke:none
    style F fill:#6366f1,color:#fff,stroke:none
    style H fill:#6366f1,color:#fff,stroke:none
    style A fill:#ef4444,color:#fff,stroke:none
    style C fill:#ef4444,color:#fff,stroke:none
    style E fill:#64748b,color:#fff,stroke:none
    style G fill:#64748b,color:#fff,stroke:none
{{< /mermaid >}}

## Generics: The complaint that aged like milk

People love to complain about how Go didn't have generics. I get it -- back then, we were duplicating code or abusing `interface{}` like it was a religion. It was frustrating.

But that's over. [Go 1.18](https://tip.golang.org/doc/go1.18) brought generics. Not the "look how clever I am" kind of generics. The real-world, clean, no-BS kind.

I've built reusable, production-grade code with generics in Go, and it's boring in the best possible way. It doesn't add magic. It just saves time, cuts clutter, and lets you focus.

## Error Handling: You don't deserve *try-catch!*

People whine about Go's verbosity around error handling like it's some tragedy.

I actually respect it.

It makes you **look at your failure paths**. It doesn't let you pretend things are okay. There's no magic trapdoor. You deal with errors like an adult -- explicitly, predictably, and with clarity.

Now with `errors.Is`, `errors.As`, and `errors.Join`, it's not even painful anymore. It's direct. And if you're repeating `if err != nil` 10 times, that's not the language's fault -- that's your function decomposition screaming for help.

## Go does not babysit your Concurrency

Goroutines are simple. Channels are powerful. But Go doesn't stop you from screwing it up.

As the memes say, this isn't a bug -- it's a feature. Go gives you the raw tools to build concurrent systems. You want guarantees? Build them. You want race protection? Design them accordingly or use the built-in race detector. You want structured concurrency? There are patterns. Learn them.

Go assumes the person writing the code knows what they're doing. And I respect that.

> Java hides you behind abstractions. Go says, "Here's the knife. Don't cut yourself."

## Performance and Runtime: Quietly ruthless

Go's performance story doesn't make headlines, but it's been sharpening its edge for years.

I've deployed Go services that boot in under `50ms` and run for months without a hiccup. It doesn't brag. It just works. And when you actually care about reliability at scale, that's what matters.

## Go is not for everything

And it shouldn't be.

If you want total memory control, go write Rust. If you're obsessed with expressiveness and type wizardry, go enjoy Haskell. If you're building mobile apps, this ain't your tool either.

But if you're building modern backend systems -- the kind that run in the cloud, talk to queues, survive restarts, and serve real traffic -- Go is it.

**Java folks will try to throw Spring Boot into a Kubernetes cluster and call it modern. It's not. It's a legacy stack duct-taped into relevance.**

Go was built for this world. *Distributed. Scalable. Cloud-native.* Minimal by design. And if that feels limiting, maybe you're just too used to hiding behind abstraction soup.

{{< mermaid >}}
graph LR
    A["Go"] --> B["Ship fast, simple"]
    C["Java / Spring"] --> D["Medium complexity"]
    E["Rust / Haskell"] --> F["Complex, more guarantees"]

    style A fill:#374151,color:#fff,stroke:none
    style B fill:#374151,color:#fff,stroke:none
    style C fill:#f59e0b,color:#fff,stroke:none
    style D fill:#f59e0b,color:#fff,stroke:none
    style E fill:#6366f1,color:#fff,stroke:none
    style F fill:#6366f1,color:#fff,stroke:none
{{< /mermaid >}}

## Personal take

I've built real systems in Go. Banking systems. Transaction processors. Cloud-native APIs. Stuff that handles money, user trust, and regulatory pressure.

It's not flashy. It's not fun in the academic sense. But Go keeps things simple and predictable and that's exactly what backend engineering demands.

If you want a language that lets you build boringly reliable systems at scale, Go's your bet.

Not because it's perfect. But because it **forces you to think clearly, fail loudly, and ship resiliently**.

And that's what good engineering is.
