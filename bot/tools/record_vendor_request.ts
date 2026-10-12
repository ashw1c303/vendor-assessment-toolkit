import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { recordVendorInput } from "../lib/schemas.js";
import { createVendorRequest } from "../lib/vendor-store.js";

export default defineTool({
  description: prompt`
    Persist a new vendor request. Extract requester name, vendor name,
    proposed service category, and urgency when the message contains them.
    Include security compliance and integration specs only when they are
    actually present. Do not guess. Returns the record and missingFields.
    Does not start research. Also upserts the request to MongoDB Atlas when
    MONGODB_URI is set (host.kv remains the local cache).
  `,
  effect: "write",
  inputSchema: recordVendorInput,
  async execute(input, ctx) {
    const { request, atlas } = await createVendorRequest(
      ctx.host.kv,
      input,
      new Date().toISOString(),
    );
    return {
      ok: true as const,
      request,
      missingFields: request.missingFields,
      advancedToResearch: false as const,
      atlas,
    };
  },
});
