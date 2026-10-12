# Vendor Onboarding

Bot Development Kit (BDK) project (`@cursor/bdk`). This file is for coding agents editing the project. The served agent's prompt is `bot/instructions.md`.

## Loop

```bash
bdk validate --dir .
bdk info --dir . --json
bdk run --dir . --message "..."
bdk eval --dir .
npm run check
```

Run the CLI under Node, never Bun. `npm run check` typechecks after tsx. Evals live at repo-root `evals/`. Vendor state is `ctx.host.kv`.

## Layout

- `bot/instructions.md` is the always-on prompt. Keep it short.
- `bot/tools/<name>.ts` is one tool per file. The filename is the tool name.
- `bot/lib/` is shared code. Never discovered.
- `evals/` is filesystem evals (`evals/evals.config.ts` required). Not `bot/evals/`. That path is ignored.
- `.cursor/skills/` is for Cursor. Runtime procedures are `bot/skills/`.

## Do not

- Grow host TypeScript for formatting, classification, or reply composition. That stays in instructions/skills. Host code owns auth, idempotency, evidence seeding, and side-effect gates.
- Add npm deps on a first cut. Stick to what `@cursor/bdk` already ships.
- Generate LangGraph, MongoDB, or a checkpoint database. Do not add `bot/result.ts`.
- Point `serve` at a parent folder during bring-up. It mounts every sibling.
- Commit `.env` or `.env.local`.

## Pointers

- Operator guide: `README.md`
- Package loop: `node_modules/@cursor/bdk/AGENTS.md`
- Docs: `npx @cursor/bdk docs`
