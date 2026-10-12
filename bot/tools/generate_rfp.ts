import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { compileRfp } from "../lib/documents.js";
import { withRfp } from "../lib/record.js";
import { getVendorRequest, saveVendorRequest } from "../lib/vendor-store.js";

export default defineTool({
  description: prompt`
    Generate the RFP document for a vendor request. Refuses unless status is
    approved. Approve is the only path that may create an RFP. This tool
    stores the document and does not send it. Persists the update to
    MongoDB Atlas when configured.
  `,
  effect: "write",
  inputSchema: z.object({
    requestId: z.string().min(1),
    regenerate: z.boolean().optional(),
  }),
  async execute({ requestId, regenerate }, ctx) {
    const request = await getVendorRequest(ctx.host.kv, requestId);
    if (request === undefined) return { ok: false as const, error: "not_found", requestId };
    if (request.status !== "approved") {
      return {
        ok: false as const,
        error: "not_approved",
        requestId,
        status: request.status,
        message: "RFP generation is refused until a human approval sets status to approved.",
      };
    }
    if (request.rfp !== null && regenerate !== true) {
      return { ok: true as const, requestId, status: request.status, rfp: request.rfp, created: false as const };
    }
    const updated = withRfp(request, compileRfp(request), new Date().toISOString());
    const { atlas } = await saveVendorRequest(ctx.host.kv, updated, {
      note: "rfp_generated",
      previousStatus: request.status,
    });
    return {
      ok: true as const,
      requestId,
      status: updated.status,
      rfp: updated.rfp,
      created: true as const,
      atlas,
    };
  },
});
