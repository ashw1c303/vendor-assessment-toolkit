import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { draftFollowUp } from "../lib/record.js";
import { getVendorRequest } from "../lib/vendor-store.js";

export default defineTool({
  description: prompt`
    Draft a follow-up that asks only for the fields still missing on this
    request. Call this whenever missingFields is non-empty. This tool never
    starts research.
  `,
  effect: "read",
  inputSchema: z.object({ requestId: z.string().min(1) }),
  async execute({ requestId }, ctx) {
    const request = await getVendorRequest(ctx.host.kv, requestId);
    if (request === undefined) {
      return { ok: false as const, error: "not_found", requestId, advancedToResearch: false as const };
    }
    return draftFollowUp(request);
  },
});
