---
name: acme-architecture
description: Use when scoring vendor fit or writing an architecture brief so the answer cites Acme's trade matching, surveillance, clearing, FIX, and overlap guidelines.
---

# Acme architecture guidelines

Cite these guidelines by id. They are the source of truth. There is no vector database.

## trade-matching

Acme runs a high-throughput, deterministic matching engine with price-time priority. A vendor must not sit in the critical matching path. Preferred integration is a pre-trade or post-trade adapter, not an in-process replacement.

## market-surveillance

Surveillance consumes normalized drop copy and emits alerts. It must not add latency to matching. Vendors attach at the drop-copy boundary.

## clearing

Clearing covers novation, margin, settlement instructions, and end-of-day positions. Vendors integrate through clearing APIs and must not hold unreconciled positions.

## fix-compatibility

Order entry and drop copy use FIX 4.2 and FIX 4.4. Any component that emits or consumes orders or executions needs native FIX or a certified adapter. Non-FIX market data is allowed only behind an Acme adapter.

## capability-overlap

Acme already operates trade matching, market surveillance, and clearing. A vendor that duplicates one of these is a fit only when it fills a stated gap and can run beside the existing module. Replacing a core module is out of pattern unless the architecture brief records that risk.
