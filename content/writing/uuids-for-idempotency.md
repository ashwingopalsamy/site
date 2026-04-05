---
title: "Why UUIDs Matter for Idempotency"
date: 2026-02-20
description: "Using UUID v7 as idempotency keys in payment authorization to prevent duplicate processing."
tags: ["payments", "go", "distributed-systems"]
---

In payment processing, processing the same authorization twice is worse than rejecting it. A customer charged twice loses trust immediately. Idempotency keys prevent this.

## The Problem

A client sends an authorization request. The network drops the response. The client retries. Without idempotency, the server processes the authorization again, resulting in a double charge.

## UUIDs as Idempotency Keys

The client generates a UUID before the first attempt and includes it in every retry. The server checks: have I seen this UUID before? If yes, return the original response. If no, process the request and store the UUID with its response.

## Why UUID v7

UUID v7 embeds a Unix timestamp in the first 48 bits, followed by random bits. This gives you:

- **Chronological ordering**: UUIDs sort by creation time, which makes database indexes efficient
- **Uniqueness**: the random component prevents collisions even at high throughput
- **Expiry**: you can garbage-collect old idempotency records by inspecting the embedded timestamp

## Key Takeaways

- Idempotency keys prevent duplicate processing in distributed systems
- UUID v7 provides time-ordered uniqueness without coordination
- The embedded timestamp enables efficient cleanup of expired records
- Always generate the idempotency key client-side, never server-side
