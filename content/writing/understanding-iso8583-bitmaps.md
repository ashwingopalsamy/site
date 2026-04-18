---
title: "Understanding ISO 8583 Bitmap Parsing"
date: 2026-04-01
description: "How payment networks encode field presence using primary and secondary bitmaps in binary messages."
tags: ["payments", "go"]
---

Every ISO 8583 message begins with a Message Type Indicator (MTI), followed by one or two bitmaps that declare which data elements are present in the message.

## What is a Bitmap?

A bitmap is a binary structure where each bit position corresponds to a data element. If bit N is set to 1, data element N is present in the message. If it is 0, the element is absent.

The primary bitmap is always 64 bits (8 bytes). If bit 1 of the primary bitmap is set, a secondary bitmap follows, extending the field range from 65 to 128.

## Parsing in Go

The parsing logic is straightforward once you understand the bit layout:

```go
func ParseBitmap(data []byte) (Bitmap, error) {
    if len(data) < 8 {
        return Bitmap{}, fmt.Errorf("bitmap data too short: %d bytes", len(data))
    }

    primary := binary.BigEndian.Uint64(data[:8])
    bm := Bitmap{Primary: primary}

    if primary&(1<<63) != 0 {
        if len(data) < 16 {
            return Bitmap{}, fmt.Errorf("secondary bitmap indicated but data too short")
        }
        bm.Secondary = binary.BigEndian.Uint64(data[8:16])
        bm.HasSecondary = true
    }

    return bm, nil
}
```

## Why This Matters

The elegance of this design is that the message is self-describing. No schema negotiation, no version headers, no content-type declarations. The bitmap IS the schema.

This means a parser can handle any valid ISO 8583 message without knowing in advance which fields will be present. The bitmap tells it exactly what to expect and where to find it.

## Key Takeaways

- Primary bitmap: bits 1-64, always present (8 bytes)
- Secondary bitmap: bits 65-128, present only if bit 1 of primary is set
- Each bit maps to one data element by position
- Bit numbering starts at 1, not 0 (bit 1 is the MSB of the first byte)
