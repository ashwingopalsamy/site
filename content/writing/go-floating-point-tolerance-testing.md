---
title: "Floating-Point Tolerance Testing in Go"
date: 2025-08-17
description: "When and why to use epsilon in floating-point comparisons, with practical Go examples and a reusable helper."
tags: ["go"]
---

Last Tuesday, I was knee-deep in a financial calculation service when my tests started failing in the most spectacular way. Everything looked right on paper, the math checked out, but Go was being... well, Go about floating-point precision. You know that sinking feeling when `0.1 + 0.2` doesn't equal `0.3`? Yeah, that was my afternoon.

This got me thinking about when we actually *need* **tolerance-based comparisons** versus when we're just cargo-culting best practices. Because let's be honest -- we've all seen that StackOverflow answer about never comparing floats directly, but when does it actually matter in real Go code?

**Here's the thing:** not every float comparison needs an epsilon. I've seen codebases where literally every float comparison uses tolerance, even when comparing against hardcoded constants like `0.0`. That's like wearing a raincoat in your living room -- technically protective, but probably unnecessary.

The question isn't "should I always use tolerance?" It's "when does floating-point precision actually bite me?"

{{< mermaid >}}
graph LR
    A["0.1 + 0.2"] --> B["IEEE 754"]
    B --> C["0.30000...04"]
    D["0.3"] --> E["IEEE 754"]
    E --> F["0.29999...99"]
    C --> G["Gap = epsilon"]
    F --> G

    style A fill:#6366f1,color:#fff,stroke:none
    style D fill:#6366f1,color:#fff,stroke:none
    style B fill:#64748b,color:#fff,stroke:none
    style E fill:#64748b,color:#fff,stroke:none
    style C fill:#ef4444,color:#fff,stroke:none
    style F fill:#ef4444,color:#fff,stroke:none
    style G fill:#f59e0b,color:#fff,stroke:none
{{< /mermaid >}}

## When tolerance matters

Let me show you a real scenario that'll make you appreciate tolerance. I was working on a discount calculation system:

```go
func calculateDiscount(price, rate float64) float64 {
    return price * rate
}

func TestDiscountCalculation(t *testing.T) {
    price := 29.99
    rate := 0.15
    expected := 4.4985

    result := calculateDiscount(price, rate)

    // This might fail!
    if result != expected {
        t.Errorf("got %v, want %v", result, expected)
    }
}
```

Looks innocent enough, right? But here's where it gets interesting. That multiplication might not give you exactly `4.4985`. You might get `4.498499999999999` or some other close-but-not-exact value.

With tolerance, you'd handle it like this:

```go
func almostEqual(a, b, tolerance float64) bool {
    return math.Abs(a-b) <= tolerance
}

func TestDiscountCalculationWithTolerance(t *testing.T) {
    price := 29.99
    rate := 0.15
    expected := 4.4985

    result := calculateDiscount(price, rate)

    if !almostEqual(result, expected, 1e-9) {
        t.Errorf("got %v, want %v", result, expected)
    }
}
```

Much more reliable. The `1e-9` tolerance works well for most financial calculations where you care about precision but not about microscopic differences.

## When you DON'T need tolerance

But here's where it gets nuanced. Some comparisons are perfectly fine without tolerance:

```go
// These are usually safe
if value == 0.0 { } // Zero has exact representation
if math.IsNaN(result) { } // Special values
if result == math.Inf(1) { } // Infinity comparisons

// This is often fine too
func multiply(a, b float64) float64 {
    return a * b
}

result1 := multiply(2.0, 3.0)
result2 := multiply(2.0, 3.0)
// Same calculation path = same result
if result1 == result2 { } // Probably safe
```

The key insight? If your floats haven't been through different computational paths, exact comparison often works fine.

{{< mermaid >}}
flowchart TD
    A["Comparing floats?"] --> B{"Result of\narithmetic?"}
    B -- Yes --> C["Use epsilon"]
    B -- No --> D{"Integer-\nconvertible?"}
    D -- Yes --> E["No epsilon needed"]
    D -- No --> F{"Currency?"}
    F -- Yes --> G["Use integer cents"]
    F -- No --> C

    style C fill:#374151,color:#fff,stroke:none
    style E fill:#6366f1,color:#fff,stroke:none
    style G fill:#f59e0b,color:#fff,stroke:none
    style A fill:#64748b,color:#fff,stroke:none
    style B fill:#64748b,color:#fff,stroke:none
    style D fill:#64748b,color:#fff,stroke:none
    style F fill:#64748b,color:#fff,stroke:none
{{< /mermaid >}}

## A real world scenario

I ran into this recently while processing sensor data. The raw values came from a JSON API, went through unit conversions, then got averaged. Classic precision nightmare territory:

```go
type SensorReading struct {
    TempCelsius float64 `json:"temperature"`
}

func convertToFahrenheit(celsius float64) float64 {
    return (celsius * 9.0 / 5.0) + 32.0
}

func averageTemperature(readings []SensorReading) float64 {
    if len(readings) == 0 {
        return 0.0
    }

    var sum float64
    for _, reading := range readings {
        sum += convertToFahrenheit(reading.TempCelsius)
    }
    return sum / float64(len(readings))
}
```

Testing this without tolerance was asking for trouble:

```go
func TestAverageTemperatureWithTolerance(t *testing.T) {
    readings := []SensorReading{
        {TempCelsius: 20.0},
        {TempCelsius: 25.0},
        {TempCelsius: 22.5},
    }

    result := averageTemperature(readings)
    expected := 71.5 // Expected Fahrenheit average

    // JSON parsing + conversion + division = precision issues
    const tolerance = 1e-10
    if math.Abs(result-expected) > tolerance {
        t.Errorf("got %v, want %v (within %v)", result, expected, tolerance)
    }
}
```

## Choosing your Epsilon

The tolerance value isn't magic. For most business applications, `1e-9` works well. For scientific computing, you might need `1e-15`. For UI coordinates, maybe `1e-6` is plenty.

I usually start with `1e-9` and adjust based on the domain. Financial calculations? Stick with `1e-9`. Game physics? Maybe `1e-6` is fine. The key is understanding your precision requirements.

## A practical helper

Here's a utility I've been using across projects:

```go
const DefaultFloatTolerance = 1e-9

func FloatEquals(a, b float64) bool {
    return FloatEqualsWithTolerance(a, b, DefaultFloatTolerance)
}

func FloatEqualsWithTolerance(a, b, tolerance float64) bool {
    // Handle special cases
    if math.IsNaN(a) && math.IsNaN(b) {
        return true
    }
    if math.IsInf(a, 0) && math.IsInf(b, 0) {
        return math.Signbit(a) == math.Signbit(b)
    }

    return math.Abs(a-b) <= tolerance
}
```

Nothing fancy, but it handles the edge cases and gives you consistent behavior across your codebase.

## To close

Use tolerance when your floats have been through computational journeys -- calculations, parsing, conversions, aggregations. Skip it for direct assignments, constants, and same-path calculations.

The real skill isn't knowing to use tolerance everywhere. It's recognizing when precision matters and when it doesn't. Your future self (and your test suite) will thank you.
