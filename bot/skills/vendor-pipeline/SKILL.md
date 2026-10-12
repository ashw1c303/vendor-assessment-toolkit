---
name: vendor-pipeline
description: Use when a vendor request must move through intake, collection, research, the architecture brief, human approval, or the weekly leadership summary.
---

# Vendor pipeline

1. Record the request with `record_vendor_request` or update the same id.
2. If `missingFields` is non-empty, call `draft_collection_followup` and stop.
3. Call `research_vendor` only when required fields are present. Pass `fixture` when live research is not configured.
4. Delegate to `public-research`, `internal-fit`, `integration-risk`, and `plantuml` in parallel, then call `compile_architecture_brief`.
5. Wait for a human. Record `approve`, `reject`, or `needs-more-info` with `record_approval_decision`. Call `generate_rfp` only when status is `approved`.
6. `weekly_leadership_summary` aggregates approved requests. It returns the summary even when Slack is not configured.

Do not create a second record for a reply. Do not fan out past the four specialists.
