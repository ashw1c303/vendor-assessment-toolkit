---
name: plantuml-architecture-generator
description: Use when a vendor integration idea needs PlantUML mapped to Acme trade matching, market surveillance, and clearing.
---

# PlantUML Architecture Generator

Given a vendor integration idea, emit one PlantUML document. Map it onto Acme's three modules. Do not invent a fourth Acme system.

Modules:

- Trade Matching: high-throughput price-time matching. Vendors stay off the critical path. Arrow label is FIX order entry only when the idea touches matching.
- Market Surveillance: normalized drop copy and alerts. Arrow only when the idea touches surveillance. Do not put the vendor on the matching latency path.
- Clearing: novation, margin, and settlement. Arrow only when the idea touches clearing.

Always draw the internal Acme flows: matching to surveillance as drop copy, and matching to clearing as executions.

Replace the placeholders below. Use `adapter required` when the idea has no FIX support.

```plantuml
@startuml acme-vendor-integration
skinparam componentStyle rectangle
title <Vendor> integration

package "Acme B2B Exchange" {
  component "Trade Matching" as Matching
  component "Market Surveillance" as Surveillance
  component "Clearing" as Clearing
}

component "<Vendor>\n<service category>" as Vendor

Matching --> Surveillance : normalized drop copy
Matching --> Clearing : executions for novation
Vendor --> Matching : FIX 4.2/4.4 order entry
Vendor --> Surveillance : drop copy / alerts
Vendor --> Clearing : settlement and margin
@enduml
```

Delete any `Vendor -->` line whose module the idea does not touch. Keep both internal Acme arrows.
