---
title: "Go Error Wrapping Patterns"
date: 2026-03-28
tags: ["go"]
url: /writing/notes/go-error-wrapping-patterns/
---

The `fmt.Errorf("context: %w", err)` pattern is the standard way to add context to errors in Go. But there are nuances worth knowing.

Always wrap with context that answers "what were you trying to do?" not "what went wrong?" The original error already says what went wrong.

Bad: `fmt.Errorf("error: %w", err)`
Good: `fmt.Errorf("parsing field DE%d: %w", fieldNum, err)`
