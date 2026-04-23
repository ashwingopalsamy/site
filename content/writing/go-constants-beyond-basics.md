---
title: "Go Constants Beyond the Basics"
date: 2024-11-13
description: "Untyped constants, compile-time evaluation, big number precision, iota patterns, and the limitations that catch experienced developers."
tags: ["go"]
---

When I first got into Go, I thought constants were simple and limited -- just fixed values, nothing fancy. But as I delved deeper, I found they're quite versatile. Yes, they're fixed values, but Go handles them in ways that are both flexible and efficient. Let's see what that means with some practical examples.

## Constants as Type-Free Values (Until They're Used)

In Go, constants are often untyped until you actually use them. They have a default kind but can be assigned to variables of different types, as long as the value fits. This makes them adaptable in a way that's unusual for a statically typed language.

Here's how that looks:

```go
const x = 10

var i int = x
var f float64 = x
var b byte = x
```

{{< mermaid >}}
graph TD
    A["const x = 5\n(untyped)"] --> B["used as int"]
    A --> C["used as float64"]
    A --> D["used as byte"]
    B --> E["int"]
    C --> F["float64"]
    D --> G["byte"]

    style A fill:#6366f1,color:#fff,stroke:none
    style B fill:#64748b,color:#fff,stroke:none
    style C fill:#64748b,color:#fff,stroke:none
    style D fill:#64748b,color:#fff,stroke:none
    style E fill:#374151,color:#fff,stroke:none
    style F fill:#374151,color:#fff,stroke:none
    style G fill:#374151,color:#fff,stroke:none
{{< /mermaid >}}

A bit analogous to Schrodinger's paradox, `x` can be an `int`, a `float64`, or even a `byte` until you assign it. This temporary flexibility lets `x` work smoothly with different types in your code. No need for casting, which keeps things neat.

You can even mix constants of different types in expressions and Go will figure out the best type for the result:

```go
const a = 1.5
const b = 2

const result = a * b // result is float64
```

Since `a` is a floating-point number, Go promotes the whole expression to `float64`. So you don't have to worry about losing precision -- Go handles it. But be careful: if you try to assign `result` to an `int`, you'll get an error. Go doesn't allow implicit conversions that might lose data.

**Limitations**

This flexibility only goes so far. Once you assign a constant to a variable, that variable's type is set:

```go
const y = 10

var z int = y       // z is an int
var k float64 = y   // y can still be used as float64
```

But if you try this:

```go
const y = 10.5

var m int = y       // Error: constant 10.5 truncated to integer
```

Go will throw an error because it won't automatically convert a floating-point constant to an integer without an explicit cast. So while constants are flexible, they won't change type to fit incompatible variables.

### Understanding Type Defaults

When you use untyped constants without specifying a type, they assume a default type:

- Untyped Integer Constants default to `int`
- Untyped Floating-Point Constants default to `float64`
- Untyped Rune Constants default to `rune` (which is `int32`)
- Untyped Complex Constants default to `complex128`
- Untyped String Constants default to `string`
- Untyped Boolean Constants default to `bool`

## Compile-Time Evaluation and Performance

Go doesn't just evaluate constants at compile time -- it also optimizes constant expressions. That means you can use constants in calculations, and Go will compute the result during compilation:

```go
const a = 100
const b = 5
const c = a * b + 20 // c is computed at compile time
```

So `c` isn't recalculated at runtime; Go has already figured out it's `520` at compile time. This can boost performance, especially in code where speed matters. By using constants, Go handles the calculations once, instead of doing them every time your program runs.

## Constants in Conditional Compilation

Go doesn't have a preprocessor like some other languages, but you can use constants in `if` statements to include or exclude code at compile time.

```go
const debug = false

func main() {
    if debug {
        fmt.Println("Debugging enabled")
    }
    // The above block might be removed by the compiler if debug is false
}
```

When `debug` is `false`, the compiler knows the `if` condition will never be true and might leave out the code inside the block. This can make your final binary smaller.

## Working with Big Numbers

One powerful feature of Go's constants is that they support very large numbers. Untyped numeric constants in Go have "infinite" precision, limited only by memory and the compiler.

```go
const bigNum = 1e1000 // This is a valid constant
```

Even though `bigNum` is way bigger than any built-in numeric type like `float64` or `int`, Go lets you define it as a constant. You can do calculations with these large numbers at compile time:

```go
const (
    a = 1e20
    b = 1e30
    c = a * b // c is 1e50
)
```

## Typed Constants with iota

If you've been using Go, you've probably seen `iota` for creating enumerated constants. It's useful because it automatically assigns incremental values.

You can also use expressions in constant declarations with `iota` to create related constants.

```go
const (
    _ = iota
    KB = 1 << (10 * iota)
    MB
    GB
    TB
)
```

This code defines constants for kilobyte, megabyte, gigabyte, and terabyte using bit shifting. It's calculated at compile time. It's a neat way to generate a series of related constants.

I find `iota` really helpful for this kind of stuff. As Go doesn't have a built-in enum type, you can effectively simulate enums using the `iota` identifier and custom types.

{{< mermaid >}}
graph LR
    A["iota=0"] --> B["1<<0 = 1\n(Read)"]
    C["iota=1"] --> D["1<<1 = 2\n(Write)"]
    E["iota=2"] --> F["1<<2 = 4\n(Execute)"]
    B --> G["Read | Write = 3"]
    D --> G

    style A fill:#64748b,color:#fff,stroke:none
    style C fill:#64748b,color:#fff,stroke:none
    style E fill:#64748b,color:#fff,stroke:none
    style B fill:#374151,color:#fff,stroke:none
    style D fill:#f59e0b,color:#fff,stroke:none
    style F fill:#ef4444,color:#fff,stroke:none
    style G fill:#6366f1,color:#fff,stroke:none
{{< /mermaid >}}

## Constants with Bitwise Operations and Shifts

Constants can use bitwise operations and shifts, even resulting in values that are bigger than any built-in type.

```go
const (
    shiftAmount = 100
    shiftedValue = 1 << shiftAmount // shiftedValue is a huge number (1267650600228229401496703205376)
)
```

Here, `shiftedValue` becomes a very large number because of the big shift amount. This value is too big for standard integer types but is valid as a constant until you try to assign it:

```go
var n int = shiftedValue // Error: constant overflows int
```

This shows that constants can represent values you can't store in variables, allowing for compile-time calculations with very large numbers.

## Limitations with Constants

While Go's constants are flexible, there are some things they can't do.

### 1. Constants Cannot Be Referenced by Pointers

Constants don't have a memory address at runtime. So you can't take the address of a constant or use a pointer to it.

```go
const x = 10
var p = &x // Error: cannot take the address of x
```

### 2. Constants with Typed nil Pointers

While `nil` can be assigned to variables of pointer, slice, map, channel, and function types, you cannot create a constant that holds a typed `nil` pointer.

```go
const nilPtr = (*int)(nil) // Error: const initializer (*int)(nil) is not a constant
```

This adds to the immutability and compile-time nature of constants in Go.

### 3. Function Calls in Constant Declarations

Only certain built-in functions can be used in constant expressions, like `len`, `cap`, `real`, `imag`, and `complex`.

```go
const str = "hello"
const length = len(str) // This works
const pow = math.Pow(2, 3) // Error: math.Pow cannot be used in constant expressions
```

### 4. Composite Types and Constants

Constants can't directly represent composite types like slices, maps, or structs. But you can use constants to initialize them.

```go
const mySlice = []int{1, 2, 3} // Error: []int{…} is not constant
```

The code above doesn't work because you can't declare a slice as a constant. However, you can use constants inside a variable slice:

```go
const a = 1
const b = 2
const c = 3

var mySlice = []int{a, b, c} // This is fine
```

Just remember, the slice itself isn't a constant -- you can't declare it as one. The elements inside can be constants, though.

### 5. Explicit Conversion When Needed

If an untyped constant can't be directly assigned due to a type mismatch or possible loss of precision, you need to use an explicit type conversion.

```go
const y = 1.9999
var i int = int(y) // This works, but you lose the decimal part
```

## Wrapping Up

I hope this gives you a better idea about constants. They're not only simple fixed values, but also a flexible feature that can make your code more expressive and efficient.
