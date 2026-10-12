# Vendor Onboarding Toolkit

BDK agent that onboards vendors onto Acme's exchange: trade matching, clearing, and market surveillance. The agent runs on Node (22.13 or newer). Do not use Bun.

Records live in `ctx.host.kv`. Architecture guidelines live in the agent, so fitment does not need a vector database. Research uses a Firecrawl MCP connection when `FIRECRAWL_API_KEY` is set, and a fixture input when it is not.

## Pipeline

1. **Intake.** Slack mentions and DMs, plus `POST /v1/channels/vendor-intake/intake`, capture requester name, vendor name, service category, and urgency.
2. **Collection.** Missing security compliance or integration specs (modules and FIX support) produce a follow-up that asks only for those fields. Replies update the same record. Research does not start while required fields are missing.
3. **Research and fitment.** `research_vendor` scores the vendor from 0 to 100 and writes a rationale for public value, reputation, FIX compatibility, and overlap with Acme modules.
4. **Architecture brief.** The agent delegates to four specialists (public research, internal fit, integration risk, PlantUML), then compiles one Solution Architecture Brief and PlantUML diagram.
5. **Human approval.** `record_approval_decision` records approve, reject, or needs-more-info. Approve parks for a human confirmation and is the only path to an RFP. Needs-more-info returns the request to collection. `generate_rfp` refuses unless status is `approved`.
6. **Weekly leadership summary.** Mondays at 09:00 UTC, `weekly_leadership_summary` aggregates approved requests into a Business Value Proposition (strategic fit with clearing and exchange goals, cost signals, competitive notes). Without Slack tokens, the tool result is the summary.

## Run locally

```bash
npm install
npm run dev
```

Playground: <http://127.0.0.1:3000/playground>

`npm run dev` serves this agent in single mode, so routes are unslugged.

Webhook intake:

```bash
curl -X POST http://127.0.0.1:3000/v1/channels/vendor-intake/intake \
  -H 'content-type: application/json' \
  -d '{"requesterName":"Priya Shah","vendorName":"Northwind Markets","serviceCategory":"drop-copy surveillance","urgency":"high"}'
```

Call a tool without a model turn:

```bash
npx bdk call draft_collection_followup --dir . --input '{"requestId":"<id from intake>"}'
```

Dispatch the Monday schedule by hand (dev mode does not fire cron). The handler calls `weekly_leadership_summary` directly, so the response's `sessionIds` may be empty. Read the stored summary with `bdk call weekly_leadership_summary --input '{"source":"read"}'` against the same state root, or `POST /v1/tools/weekly_leadership_summary` on this server.

```bash
curl -X POST http://127.0.0.1:3000/v1/dev/schedules/weekly-leadership
```

Approving from the playground parks `record_approval_decision` until a person confirms it. `bdk call` is an operator call and runs that tool immediately. Either way, `generate_rfp` refuses unless status is `approved`.

## Validate

```bash
npm run check
npx bdk validate --dir .
npx bdk info --dir . --json
npx bdk eval --dir . --list
npx bdk eval --dir . --tag smoke
```

`npm run check` is `tsc --noEmit`. tsx does not typecheck. `validate`, `info`, and `bdk call` do not need a Cursor credential. `bdk eval` runs the smoke cases as model turns and needs `CURSOR_API_KEY` or `npx bdk login`. Without a credential the cases fail at `succeeded` and do not call tools.

## Follow-ups for live delivery

Slack and Firecrawl are not required for local HTTP, the playground, or fixture research.

- Slack: `npx bdk slack create --dir . --name "Vendor Onboarding" --prefix VENDOR_ONBOARDING`
  That wizard attaches the Slack app and writes `VENDOR_ONBOARDING_SLACK_BOT_TOKEN` and `VENDOR_ONBOARDING_SLACK_APP_TOKEN` to `.env.local`. Do not commit that file. Set `VENDOR_ONBOARDING_EXEC_SLACK_CHANNEL` when the Monday summary should post to an executive channel.
- Research: set `FIRECRAWL_API_KEY`. Exa is an acceptable swap; see the comment in `bot/mcp-connections/research.ts`.

Names for those variables are listed in `env.example`.
