import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { scoreFitment } from "../lib/documents.js";
import { getRequest, researchBlocked, saveRequest, withResearch } from "../lib/record.js";
import { gatherResearch } from "../lib/research.js";
import { researchFixtureInput } from "../lib/schemas.js";

export default defineTool({
  description: prompt`
    Research a vendor and write a fitment score from 0 to 100 plus a
    rationale covering public value, reputation, FIX compatibility, and
    overlap with Acme modules. Refuses while required fields are missing.
    Pass fixture when no Firecrawl key is configured or when the caller
    supplies pinned research. Do not call Firecrawl tools yourself.
  `,
  effect: "write",
  inputSchema: z.object({
    requestId: z.string().min(1),
    fixture: researchFixtureInput.optional(),
  }),
  async execute({ requestId, fixture }, ctx) {
    const request = await getRequest(ctx.host.kv, requestId);
    if (request === undefined) {
      return { ok: false as const, error: "not_found", requestId, advancedToResearch: false as const };
    }
    const blocked = researchBlocked(request);
    if (blocked !== undefined) {
      return {
        ok: false as const,
        error: blocked,
        requestId,
        status: request.status,
        missingFields: request.missingFields,
        advancedToResearch: false as const,
      };
    }
    const gathered = await gatherResearch(
      ctx.host.mcp,
      `${request.vendorName ?? ""} ${request.serviceCategory ?? ""} reputation FIX protocol`.trim(),
      fixture,
    );
    if (!gathered.ok) {
      return {
        ok: false as const,
        error: gathered.error,
        message: gathered.message,
        requestId,
        status: request.status,
        advancedToResearch: false as const,
      };
    }
    const scored = scoreFitment(request, gathered.signals);
    const updated = withResearch(request, scored, new Date().toISOString());
    await saveRequest(ctx.host.kv, updated);
    return {
      ok: true as const,
      requestId,
      status: updated.status,
      fitmentScore: updated.fitmentScore,
      fitmentRationale: updated.fitmentRationale,
      researchSummary: updated.researchSummary,
      researchSource: gathered.signals.source,
      missingFields: updated.missingFields,
      advancedToResearch: true as const,
    };
  },
});
