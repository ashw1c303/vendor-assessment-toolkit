import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { createRequest } from "../lib/record.js";
import { recordVendorInput } from "../lib/schemas.js";

export default defineTool({
  description: prompt`
    Persist a new vendor request. Extract requester name, vendor name,
    proposed service category, and urgency when the message contains them.
    Include security compliance and integration specs only when they are
    actually present. Do not guess. Returns the record and missingFields.
    Does not start research.
  `,
  effect: "write",
  inputSchema: recordVendorInput,
  async execute(input, ctx) {
    const request = await createRequest(ctx.host.kv, input, new Date().toISOString());
    return {
      ok: true as const,
      request,
      missingFields: request.missingFields,
      advancedToResearch: false as const,
    };
  },
});
