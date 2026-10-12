# Vendor Onboarding

Bot Development Kit (BDK) project (`@cursor/bdk`). This file is for coding agents editing the project. The served agent's prompt is `bot/instructions.md`.

## Loop

```bash
bdk validate --dir .
bdk info --dir . --json
bdk run --dir . --message "..."
bdk eval --dir .
npm run check
npm run smoke:atlas
```

Run the CLI under Node, never Bun. `npm run check` typechecks after tsx. Evals live at repo-root `evals/`. Vendor state is `ctx.host.kv` (fast cache) plus MongoDB Atlas stage tracking via `bot/lib/vendor-store.ts` when `MONGODB_URI` or `MONGODB_MOCK=1` is set.

## Layout

- `bot/instructions.md` is the always-on prompt. Keep it short.
- `bot/tools/<name>.ts` is one tool per file. The filename is the tool name.
- `bot/lib/` is shared code. Never discovered. Atlas dual-write lives in `bot/lib/vendor-store.ts` and `bot/lib/mongo.ts`.
- `bot/mcp-connections/atlas.ts` is the optional MongoDB MCP (stdio). Never name an account file `cursor.ts`.
- `evals/` is filesystem evals (`evals/evals.config.ts` required). Not `bot/evals/`. That path is ignored.
- `.cursor/skills/` is for Cursor. Runtime procedures are `bot/skills/`.

## Do not

- Grow host TypeScript for formatting, classification, or reply composition. That stays in instructions/skills. Host code owns auth, idempotency, evidence seeding, side-effect gates, and Atlas stage persistence.
- Add npm deps casually. The `mongodb` driver is intentional for Atlas stage tracking.
- Generate LangGraph or a separate checkpoint database beyond the Atlas `vendor_requests` collection. Do not add `bot/result.ts`.
- Hardcode connection strings, API keys, or PII. Read secrets from env; document names in `env.example` only.
- Point `serve` at a parent folder during bring-up. It mounts every sibling.
- Commit `.env` or `.env.local`.

## Pointers

- Operator guide: `README.md`
- Package loop: `node_modules/@cursor/bdk/AGENTS.md`
- Docs: `npx @cursor/bdk docs`
