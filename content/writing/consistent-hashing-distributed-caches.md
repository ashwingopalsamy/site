---
title: "Consistent Hashing in Distributed Caches"
date: 2026-03-15
description: "Why naive modular hashing breaks when nodes join or leave, and how consistent hashing fixes it."
tags: ["distributed-systems", "go"]
---

When you distribute data across multiple cache nodes, the naive approach is modular hashing: `node = hash(key) % num_nodes`. This works until you add or remove a node.

## The Problem with Modular Hashing

If you have 4 nodes and add a 5th, almost every key remaps to a different node. With `hash(key) % 4` becoming `hash(key) % 5`, roughly 80% of your cache is invalidated instantly. Under load, this is a cache stampede.

## How Consistent Hashing Works

Consistent hashing arranges the hash space into a ring. Each node is assigned one or more positions on the ring. A key is hashed to a position, and the first node clockwise from that position owns the key.

When a node joins, it takes responsibility for a portion of its neighbor's range. When a node leaves, its range is absorbed by the next node clockwise. In both cases, only `K/N` keys need to move, where K is the total number of keys and N is the number of nodes.

## Virtual Nodes

Real implementations use virtual nodes -- each physical node gets multiple positions on the ring. This smooths out the distribution and prevents hotspots caused by uneven hash space allocation.

## Key Takeaways

- Modular hashing invalidates ~(N-1)/N keys on node changes
- Consistent hashing invalidates only ~K/N keys
- Virtual nodes solve the distribution imbalance problem
- Used by DynamoDB, Cassandra, Memcached, and most distributed caches
