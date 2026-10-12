import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { compileBrief } from "../lib/documents.js";
import { getRequest, saveRequest, withBrief } from "../lib/record.js";

export default defineTool({
  description: prompt`
    Compile one Solution Architecture Brief and PlantUML diagram after the
    four subagents (public-research, internal-fit, integration-risk,
    plantuml) have reported. Pass their notes. Missing notes are filled
    from the stored research and Acme guidelines. Moves the request to
    awaiting_approval. Does not generate an RFP.
  `,
  effect: "write",
  inputSchema: z.object({
    requestId: z.string().min(1),
    publicResearch: z.string().optional(),
    internalFit: z.string().optional(),
    integrationRisk: z.string().optional(),
    plantUml: z.string().optional(),
  }),
  async execute(input, ctx) {
    const request = await getRequest(ctx.host.kv, input.requestId);
    if (request === undefined) {
      return { ok: false as const, error: "not_found", requestId: input.requestId };
    }
    if (request.missingFields.length > 0) {
      return {
        ok: false as const,
        error: "required_fields_missing",
        requestId: request.id,
        missingFields: request.missingFields,
      };
    }
    if (request.fitmentScore === null || request.status === "intake" || request.status === "collecting") {
      return { ok: false as const, error: "research_required", requestId: request.id, status: request.status };
    }
    if (request.status === "approved" || request.status === "rejected") {
      return { ok: false as const, error: "record_closed", requestId: request.id, status: request.status };
    }
    const brief = compileBrief(request, input);
    const updated = withBrief(request, brief.markdown, brief.plantUml, new Date().toISOString());
    await saveRequest(ctx.host.kv, updated);
    return {
      ok: true as const,
      requestId: updated.id,
      status: updated.status,
      architectureBrief: updated.architectureBrief,
      plantUml: updated.plantUml,
    };
  },
});
