---
title: "Why slog Over zerolog"
date: 2026-03-10
description: "slog is stdlib, zerolog is faster but the gap has closed. For new projects, slog wins on API clarity and zero dependencies."
tags: ["go"]
url: /writing/notes/why-slog-over-zerolog/
---

Go 1.21 introduced `log/slog` in the standard library. For new projects, I now default to slog over zerolog.

The API is cleaner, it is part of the standard library (no dependency), and the handler interface makes it trivial to swap backends. The performance gap that once justified zerolog has narrowed significantly.
