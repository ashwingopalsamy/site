---
title: "Go's UTF-8 Identifier Limitation"
date: 2024-11-12
description: "Chinese characters work in Go identifiers but Tamil combining marks don't. A look at Unicode categories and the Go spec's design choice."
tags: ["go"]
---

I've been exploring Go's UTF-8 support lately, and was curious about how well it handles non-Latin scripts in code. This post covers a detailed overview about the same.

## Go and UTF-8

We know that Go source files are UTF-8 encoded by default. This means you can, in theory, use Unicode characters in your variable names, function names and more.

For example, in the official Go playground [boilerplate code](https://go.dev/play/), you might come across code like this:

```go
package main

import "fmt"

func main() {
    消息 := "Hello, World!"
    fmt.Println(消息)
}
```

Here, `消息` is Chinese for "message." Go handles this without any issues, thanks to its Unicode support. This capability is one reason why Go has gained popularity in countries like China and Japan -- developers can write code using identifiers meaningful in their own languages.

You won't believe it, but there's some popularity in China, for writing code in their native language and I love it.

{{< mermaid >}}
flowchart TD
    A["Character"] --> B{"Letter\n(Lu/Ll/Lo)?"}
    B -- Yes --> C["Valid identifier start"]
    B -- No --> D{"Mark/Digit\n(Mn/Mc/Nd)?"}
    D -- Yes --> E["Valid continuation only"]
    D -- No --> F["Invalid in identifiers"]

    style C fill:#10b981,color:#fff,stroke:none
    style E fill:#f59e0b,color:#fff,stroke:none
    style F fill:#ef4444,color:#fff,stroke:none
    style A fill:#64748b,color:#fff,stroke:none
    style B fill:#6366f1,color:#fff,stroke:none
    style D fill:#6366f1,color:#fff,stroke:none
{{< /mermaid >}}

## Attempting to Use Tamil Identifiers

Naturally, I wanted to try this out with Tamil, my mother tongue. [Tamil](https://en.wikipedia.org/wiki/Tamil_language), one of the world's oldest languages, is spoken by over 85 million people globally and uses a non-Latin script quite distinct from widely-used scripts like Chinese. While coding in Tamil isn't common even in regions where it's spoken, its unique structure made it an intriguing choice for my experiment with Go's Unicode support.

Here's a simple example I wrote:

```go
package main

import "fmt"

func main() {
    எண்ணிக்கை := 42 // "எண்ணிக்கை" means "number"
    fmt.Println("Value:", எண்ணிக்கை)
}
```

At first glance, this seems straightforward that can run without any errors.

But, when I tried to compile the code, I ran into errors:

```
./prog.go:6:11: invalid character U+0BCD '்' in identifier
./prog.go:6:17: invalid character U+0BBF 'ி' in identifier
./prog.go:6:23: invalid character U+0BCD '்' in identifier
./prog.go:6:29: invalid character U+0BC8 'ை' in identifier
./prog.go:7:33: invalid character U+0BCD '்' in identifier
./prog.go:7:39: invalid character U+0BBF 'ி' in identifier
./prog.go:7:45: invalid character U+0BCD '்' in identifier
./prog.go:7:51: invalid character U+0BC8 'ை' in identifier
```

### Understanding the Issue with Tamil Combining Marks

To understand what's going on, it's essential to know a bit about how Tamil script works.

Tamil is an [abugida](https://en.wikipedia.org/wiki/Abugida) -- a writing system where each consonant-vowel sequence is written as a unit. In Unicode, this often involves combining a base consonant character with one or more combining marks that represent vowels or other modifiers.

**For example:**

- The Tamil letter `க` (U+0B95) represents the consonant sound "ka"
- To represent "ki" you'd combine `க` with the vowel sign `ி` (U+0BBF), resulting in `கி`
- The vowel sign `ி` is a **combining mark**, specifically classified as a [Non-Spacing Mark](https://www.compart.com/en/unicode/category/Mn) in Unicode

### Here's where the problem arises

{{< callout type="info" >}}
Go's language specification allows Unicode letters in identifiers but excludes combining marks. Specifically, identifiers can include characters that are classified as "Letter" (categories `Lu`, `Ll`, `Lt`, `Lm`, `Lo`, or `Nl`) and digits, but not combining marks (categories `Mn`, `Mc`, `Me`).
{{< /callout >}}

### Examples of Combining Marks in Tamil

Let's look at how Tamil characters are formed:

**Standalone Consonant:** `க` (U+0B95) -- Allowed in Go identifiers.

**Consonant + Vowel Sign:** `கா` (U+0B95 U+0BBE) -- Not allowed because `ா` (U+0BBE) is a combining mark (`Mc`).

**Consonant + Vowel Sign:** `கி` (U+0B95 U+0BBF) -- Not allowed because `ி` (U+0BBF) is a combining mark (`Mn`).

**Consonant + Vowel Sign:** `கூ` (U+0B95 U+0BC2) -- Not allowed because `ூ` (U+0BC2) is a combining mark (`Mc`).

In the identifier `எண்ணிக்கை` ("number"), the characters include combining marks:

- `எ` (U+0B8E) -- Letter, allowed
- `ண்` (U+0BA3 U+0BCD) -- Formed by `ண` (U+0BA3) and the virama `்` (U+0BCD), a combining mark (`Mn`)
- `ண` (U+0BA3) -- Letter, allowed
- `ிக்கை` -- Contains combining marks like `ி` (U+0BBF) and `ை` (U+0BC8)

Because these combining marks are not allowed in Go identifiers, the compiler throws errors when it encounters them.

{{< mermaid >}}
graph LR
    A["Tamil syllable"] --> B["Base consonant\n(Lo: valid)"]
    A --> C["Vowel sign\n(Mc: continuation only)"]
    B --> D["Visually incomplete\nalone"]
    C --> D

    style A fill:#64748b,color:#fff,stroke:none
    style B fill:#10b981,color:#fff,stroke:none
    style C fill:#ef4444,color:#fff,stroke:none
    style D fill:#f59e0b,color:#fff,stroke:none
{{< /mermaid >}}

## Why Chinese Characters Work but Tamil Doesn't

Chinese characters are generally classified under the "Letter, Other" (`Lo`) category in Unicode. They are standalone symbols that don't require combining marks to form complete characters. This is why identifiers like `消息` work perfectly in Go.

**Practical Implications**

The inability to use combining marks in identifiers has significant implications for scripts like Tamil:

- Without combining marks, it's nearly impossible to write meaningful identifiers in Tamil
- Using native scripts can make learning to code more accessible, but these limitations hinder that possibility, particularly for languages that follow abugida-based writing systems

## What's wrong here?

Actually, nothing really!

Go's creators primarily aimed for consistent string handling and alignment with modern web standards through UTF-8 support. They didn't **necessarily intend for "native-language" coding** in identifiers, especially with scripts requiring combining marks.

I wanted to experiment how far we could push Go's non-Latin alphabet support. Although most developers use and prefer English for coding, I thought it would be insightful to explore this aspect of Go's Unicode support.
