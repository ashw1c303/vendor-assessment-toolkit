import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { getVendorRequest } from "../lib/vendor-store.js";

export default defineTool({
  description: prompt`
    Read one vendor request from host.kv (fast local cache; Atlas is the
    durable stage tracker). Use this before research or an approval decision
    so you are looking at the stored record.
  `,
  effect: "read",
  inputSchema: z.object({ requestId: z.string().min(1) }),
  async execute({ requestId }, ctx) {
    const request = await getVendorRequest(ctx.host.kv, requestId);
    if (request === undefined) return { ok: false as const, error: "not_found", requestId };
    return { ok: true as const, request };
  },
});
