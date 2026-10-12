import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { withDecision } from "../lib/record.js";
import { getVendorRequest, saveVendorRequest } from "../lib/vendor-store.js";

const inputSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["approve", "reject", "needs-more-info"]),
  note: z.string().optional(),
  fields: z.array(z.string()).optional(),
});

export default defineTool({
  description: prompt`
    Record a human approval decision on a vendor request. approve is allowed
    only from awaiting_approval and parks for a human confirmation before it
    runs. reject closes the request. needs-more-info returns it to collection.
    This tool does not generate an RFP. Persists the decision stage to
    MongoDB Atlas when configured.
  `,
  effect: "write",
  needsApproval: (input) => input.decision === "approve",
  inputSchema,
  async execute(input, ctx) {
    const request = await getVendorRequest(ctx.host.kv, input.requestId);
    if (request === undefined) {
      return { ok: false as const, error: "not_found", requestId: input.requestId, decision: input.decision };
    }
    const decided = withDecision(request, input.decision, input.fields, new Date().toISOString());
    if (!decided.ok) {
      return {
        ok: false as const,
        error: decided.error,
        requestId: input.requestId,
        decision: input.decision,
        status: request.status,
      };
    }
    let stored = decided.request;
    if (input.note !== undefined && input.note.trim() !== "") {
      const specs = stored.integrationSpecs ?? { modules: [], fixSupport: "", notes: "" };
      const note = `Decision ${input.decision}: ${input.note.trim()}`;
      stored = {
        ...stored,
        integrationSpecs: {
          ...specs,
          notes: specs.notes === "" ? note : `${specs.notes}\n${note}`,
        },
      };
    }
    const stageNote =
      input.note !== undefined && input.note.trim() !== ""
        ? `${input.decision}: ${input.note.trim()}`
        : input.decision;
    const { atlas } = await saveVendorRequest(ctx.host.kv, stored, {
      note: stageNote,
      previousStatus: request.status,
    });
    return {
      ok: true as const,
      requestId: stored.id,
      decision: input.decision,
      status: stored.status,
      missingFields: stored.missingFields,
      rfpGenerated: false as const,
      atlas,
    };
  },
});
