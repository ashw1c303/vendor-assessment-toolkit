import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { updateRequest } from "../lib/record.js";
import { updateVendorInput } from "../lib/schemas.js";

export default defineTool({
  description: prompt`
    Update an existing vendor request by id. Use this for collection replies
    so the same record is filled in. Does not start research.
  `,
  effect: "write",
  inputSchema: updateVendorInput,
  async execute(input, ctx) {
    const result = await updateRequest(ctx.host.kv, input, new Date().toISOString());
    if (!result.ok) {
      return { ok: false as const, error: result.error, request: result.request, advancedToResearch: false as const };
    }
    return {
      ok: true as const,
      request: result.request,
      missingFields: result.request.missingFields,
      advancedToResearch: false as const,
    };
  },
});
