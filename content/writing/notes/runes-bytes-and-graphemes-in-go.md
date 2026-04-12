---
title: "Runes, Bytes, and Graphemes in Go"
date: 2025-08-09
tags: ["go", "unicode"]
url: /writing/notes/runes-bytes-and-graphemes-in-go/
---

I once ran into this problem of differentiating runes, bytes and graphemes while handling names in Tamil and emoji in a Go web app: a string that *looked* short wasn't, and reversing it produced gibberish. The culprit wasn't Go being flawed, it was me making assumptions about what "a character" means.

Let's map the territory precisely.

{{< mermaid >}}
graph TD
    G["Grapheme Cluster<br/>(what users see)"]
    R1["Rune 1<br/>(code point)"]
    R2["Rune 2<br/>(combining mark)"]
    B1["Bytes<br/>(1-4 per rune)"]
    B2["Bytes<br/>(1-4 per rune)"]
    G --> R1
    G --> R2
    R1 --> B1
    R2 --> B2
    style G fill:#10b981,color:#fff,stroke:none
    style R1 fill:#6366f1,color:#fff,stroke:none
    style R2 fill:#6366f1,color:#fff,stroke:none
    style B1 fill:#64748b,color:#fff,stroke:none
    style B2 fill:#64748b,color:#fff,stroke:none
{{< /mermaid >}}

## 1. Bytes: the raw material Go calls a string

Go represents strings as immutable UTF-8 byte sequences. What we *see* isn't what Go handles under the hood.

```go
s := "வணக்கம்"
fmt.Println(len(s)) // 21
```

The length is 21 bytes, not visible symbols. Every Tamil character can span 3 bytes. Even simple-looking emojis stretch across multiple bytes.

## 2. Runes: Unicode code points

`string` to `[]rune` gives you code points, but still not what a human perceives.

```go
rs := []rune(s)
fmt.Println(len(rs)) // 7
```

Here it's 7 runes, but some Tamil graphemes (like "க்") combine two runes: `க` + `்`.

## 3. Grapheme clusters: the units users actually see

Go's standard library stops at runes. To work with visible characters, you need a grapheme-aware library like `github.com/rivo/uniseg`.

```go
for gr := uniseg.NewGraphemes(s); gr.Next(); {
    fmt.Printf("%q\n", gr.Str())
}
```

That outputs what a human reads: "வ", "ண", "க்", "க", "ம்", and even a heart emoji as a single unit.

{{< mermaid >}}
graph LR
    T["வணக்கம் (Tamil)"]
    T --> |"len()"| BY["21 bytes"]
    T --> |"[]rune"| RU["7 runes"]
    T --> |"uniseg"| GR["5 graphemes"]
    style T fill:#10b981,color:#fff,stroke:none
    style BY fill:#ef4444,color:#fff,stroke:none
    style RU fill:#f59e0b,color:#fff,stroke:none
    style GR fill:#10b981,color:#fff,stroke:none
{{< /mermaid >}}

## Why this matters

If your app deals with names, chats, or any multilingual text, indexing by bytes will break things. Counting runes helps but can still split what you intend as one unit. Grapheme-aware operations align with what users actually expect.

Real bugs I've seen: Tamil names chopped mid-character, emoji reactions breaking because only one code point was taken.

## Quick reference

| Task | Approach |
|------|----------|
| Count code points | `utf8.RuneCountInString(s)` |
| Count visible units | Grapheme iteration (`uniseg`) |
| Reverse text | Parse into graphemes, reverse slice, join |
| Slice safely | Only use `s[i:j]` on grapheme boundaries |

Think about what you intend to manipulate: the raw bytes, the code points, or what a user actually reads on screen, and choose the right level.
