---
title: "Designing Rate Limiters for Payment Systems"
date: 2026-04-07
description: "How to build rate limiters that protect authorization infrastructure without rejecting legitimate traffic. Token bucket math, sliding window trade-offs, and the distributed coordination problem."
tags: ["distributed-systems", "payments", "go"]
math: true
---

Rate limiting in payment systems is different from rate limiting in a typical web API. A false positive -- rejecting a legitimate authorization -- is a failed transaction. A customer's card gets declined at checkout. That is not an acceptable failure mode.

This article walks through the design of a rate limiter that protects infrastructure without creating false declines.

## The Architecture

A payment authorization pipeline typically looks like this:

{{< mermaid >}}
graph LR
    A[Card Network] -->|ISO 8583| B[Parser API]
    B -->|gRPC| C[Distributor API]
    C -->|gRPC| D[Account Service]
    C -->|gRPC| E[Risk Engine]
    C -->|gRPC| F[Ledger]
    style B fill:#10b981,color:#fff,stroke:none
    style C fill:#10b981,color:#fff,stroke:none
{{< /mermaid >}}

The rate limiter sits between the Parser API and the Distributor API. It must make a decision in under 1ms -- any longer and it becomes the bottleneck in a sub-second pipeline.

{{< callout type="warning" >}}
Never rate-limit at the card network ingress point. Network protocols like ISO 8583 have strict timeout windows. A delayed response is worse than a fast decline -- it triggers a reversal cascade.
{{< /callout >}}

## Choosing an Algorithm

There are three common approaches, each with different trade-offs:

### Token Bucket

The token bucket algorithm maintains a counter that refills at a fixed rate. Each request consumes one token. When tokens are exhausted, requests are rejected.

The math is straightforward. Given a bucket capacity $C$ and a refill rate $r$ tokens per second, the maximum burst size equals $C$, and the sustained throughput equals $r$.

$$\text{tokens}(t) = \min\left(C,\ \text{tokens}(t_0) + r \cdot (t - t_0)\right)$$

{{< callout type="tip" >}}
Set $C$ to handle your peak burst (Black Friday spike) and $r$ to your sustained p99 throughput. For authorization systems, measure both per-issuer and per-BIN to avoid penalizing an entire bank for one merchant's spike.
{{< /callout >}}

### Sliding Window Log

Tracks the exact timestamp of every request in a time window. Precise, but memory-intensive.

For $n$ requests in the current window of duration $W$:

$$\text{rate} = \frac{n}{W}$$

### Sliding Window Counter

A hybrid: divides time into fixed slots and interpolates between the current and previous slot.

$$\text{count} = \text{prev} \times \left(1 - \frac{t_{\text{elapsed}}}{W}\right) + \text{curr}$$

{{< compare >}}
{{< compare-left title="Token Bucket" >}}
**Pros:** O(1) memory, O(1) time, allows bursts

**Cons:** No per-client fairness without separate buckets

**Best for:** Global throughput protection
{{< /compare-left >}}
{{< compare-right title="Sliding Window" >}}
**Pros:** Precise rate tracking, smooth distribution

**Cons:** O(n) memory for log variant, interpolation error for counter variant

**Best for:** Per-client or per-issuer fairness
{{< /compare-right >}}
{{< /compare >}}

## The Distributed Coordination Problem

In a multi-region deployment, each instance of the rate limiter sees only local traffic. Without coordination, a client can exceed the global limit by spreading requests across regions.

{{< mermaid >}}
sequenceDiagram
    participant Client
    participant Region A
    participant Region B
    participant Redis

    Client->>Region A: Auth Request 1
    Client->>Region B: Auth Request 2
    Region A->>Redis: INCR counter
    Region B->>Redis: INCR counter
    Redis-->>Region A: count=1 (allow)
    Redis-->>Region B: count=2 (allow)
    Note over Redis: Both allowed,<br/>but combined rate<br/>may exceed limit
{{< /mermaid >}}

{{< callout type="insight" >}}
The fundamental tension: strong consistency (single Redis) adds a network hop to every authorization, while eventual consistency (local counters synced periodically) allows brief over-admission. For payment systems, brief over-admission is almost always preferable to adding latency.
{{< /callout >}}

## Implementation in Go

The token bucket is the right choice for our use case: O(1) operations, burst tolerance, and simple distributed coordination via atomic counters.

```go
type TokenBucket struct {
    mu       sync.Mutex
    tokens   float64
    capacity float64
    rate     float64
    lastTime time.Time
}

func (tb *TokenBucket) Allow() bool {
    tb.mu.Lock()
    defer tb.mu.Unlock()

    now := time.Now()
    elapsed := now.Sub(tb.lastTime).Seconds()
    tb.tokens = math.Min(tb.capacity, tb.tokens+tb.rate*elapsed)
    tb.lastTime = now

    if tb.tokens >= 1 {
        tb.tokens--
        return true
    }
    return false
}
```

{{< callout type="note" >}}
This implementation uses a mutex for simplicity. In production, consider `sync/atomic` with CAS operations for lock-free performance, or a sharded bucket per goroutine with periodic merging.
{{< /callout >}}

## Capacity Planning

For a system processing $\lambda$ transactions per second with target rejection rate below $\epsilon$:

$$C \geq \lambda \cdot T_{\text{burst}}$$

where $T_{\text{burst}}$ is the expected burst duration.

$$r \geq \lambda \cdot (1 + \sigma)$$

where $\sigma$ is the traffic variance coefficient.

If your p99 latency budget is $L$ milliseconds and the rate limiter check takes $\delta$ ms:

$$L_{\text{remaining}} = L - \delta$$

For our authorization pipeline where $L = 200\text{ms}$ and the rate limiter adds $\delta = 0.3\text{ms}$:

$$L_{\text{remaining}} = 200 - 0.3 = 199.7\text{ms}$$

The overhead is negligible -- which is exactly the point. A rate limiter that measurably impacts latency is a rate limiter that needs to be redesigned.

## Key Takeaways

{{< callout type="info" >}}
**Design decisions for payment rate limiters:**

- Token bucket for global protection, sliding window for per-client fairness
- Local-first with async sync beats centralized coordination for latency
- Set capacity from measured burst patterns, not theoretical maximums
- Monitor rejection rate as a business metric, not just an infra metric
{{< /callout >}}

{{< compare >}}
{{< compare-left title="Web API Rate Limiting" >}}
Return `429 Too Many Requests`

Client retries with backoff

False positives are annoying but recoverable
{{< /compare-left >}}
{{< compare-right title="Payment Rate Limiting" >}}
Return decline response code in ISO 8583

No retry -- transaction is failed

False positives are declined cards at checkout
{{< /compare-right >}}
{{< /compare >}}

The difference between rate limiting a REST API and rate limiting an authorization pipeline is the cost of a false positive. In payments, you are not protecting a server -- you are deciding whether someone's groceries get paid for.

[^1]: Token bucket was first described by Turner (1986) in the context of ATM network traffic shaping. The algorithm maps naturally to payment processing because both domains deal with bursty traffic that must be smoothed without dropping legitimate requests.
