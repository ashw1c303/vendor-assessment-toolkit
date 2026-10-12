---
name: scaffold-workflow-step
description: Use when adding a BDK tool or subagent step that must persist with host.kv, return strict JSON, and handle errors. Replaces any LangGraph node or MongoDB checkpoint scaffold.
---

# Scaffold workflow step

Add a BDK step under this repository. Persistence is `ctx.host.kv`. Do not generate LangGraph, n8n, MongoDB, Atlas, checkpoint databases, or `bot/result.ts`.

## Tool

Create `bot/tools/<name>.ts`. One tool per file. The filename is the tool name. Return a JSON object. Declare `effect`. Throw or return `ok: false` with a stable `error` code. Do not hide secrets in source.

```ts
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";

const KEY = "example/item";

export default defineTool({
  description: "Store one JSON record and return it.",
  effect: "write",
  inputSchema: z.object({ id: z.string().min(1), note: z.string() }),
  async execute({ id, note }, ctx) {
    try {
      const record = { id, note, updatedAt: new Date().toISOString() };
      await ctx.host.kv.put(`${KEY}/${id}`, record);
      return { ok: true as const, record };
    } catch (error) {
      const message = error instanceof Error ? error.message : "write_failed";
      return { ok: false as const, error: "write_failed", message };
    }
  },
});
```

Gate side effects in the tool. If a later turn must see the value, write kv before returning. A module `Map` does not survive a new process.

## Subagent

Create `bot/subagents/<id>/agent.ts` with a required `description`, plus `instructions.md`. Do not give the subagent its own tools, schedules, or channels. The parent delegates with the `task` tool. Keep the fan-out to a small fixed set.

```ts
import { defineAgent } from "@cursor/bdk";

export default defineAgent({
  description: "When to delegate: one sentence the parent can route on.",
});
```

After adding the file, run `npx tsc --noEmit -p .` and `npx bdk validate --dir .`. tsx does not typecheck.
