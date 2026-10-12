import { defineEval } from "@cursor/bdk/evals";

function missingFollowUp(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const record = value as {
    ok?: boolean;
    advancedToResearch?: boolean;
    missingFields?: string[];
  };
  const fields = record.missingFields ?? [];
  return (
    record.ok === true &&
    record.advancedToResearch === false &&
    fields.includes("securityCompliance") &&
    fields.some((field) => field.startsWith("integrationSpecs"))
  );
}

function fitmentShape(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const record = value as {
    ok?: boolean;
    fitmentScore?: number;
    fitmentRationale?: Record<string, unknown>;
  };
  const rationale = record.fitmentRationale;
  if (record.ok !== true || typeof record.fitmentScore !== "number") return false;
  if (record.fitmentScore < 0 || record.fitmentScore > 100) return false;
  if (typeof rationale !== "object" || rationale === null) return false;
  return (
    typeof rationale.publicValue === "string" &&
    typeof rationale.reputation === "string" &&
    typeof rationale.fixCompatibility === "string" &&
    typeof rationale.moduleOverlap === "string"
  );
}

const fixture = JSON.stringify({
  summary: "Northwind publishes a drop-copy analytics product used by two exchanges. No enforcement actions found.",
  publicValue: 18,
  reputation: 16,
  sources: [
    {
      title: "Northwind product note",
      url: "https://example.com/northwind",
      excerpt: "Drop-copy analytics for surveillance teams. FIX 4.4 certified.",
    },
  ],
});

export default defineEval({
  tags: ["smoke"],
  cases: [
    {
      id: "extract",
      description: "Extracts requester, vendor, category, and urgency into the intake tool.",
      async test(t) {
        await t.send(
          "Priya Shah submitted a vendor request. The vendor is Northwind Markets. Proposed service category: drop-copy surveillance. Urgency: high. Record that request and do not research it.",
        );
        t.succeeded();
        t.calledTool("record_vendor_request", {
          input: {
            requesterName: /priya shah/i,
            vendorName: /northwind/i,
            serviceCategory: /surveillance/i,
            urgency: /high/i,
          },
        });
        t.notCalledTool("research_vendor");
      },
    },
    {
      id: "missing-fields",
      description: "Asks only for missing fields and does not complete research.",
      async test(t) {
        await t.send(
          "New request from Priya Shah for vendor Northwind Markets, category drop-copy surveillance, urgency high. Security compliance and integration specs were not provided. Ask only for what is missing. Do not research.",
        );
        t.succeeded();
        t.calledTool("draft_collection_followup", { output: missingFollowUp });
        t.notCalledTool("research_vendor");
        t.notCalledTool("generate_rfp");
      },
    },
    {
      id: "fitment",
      description: "Fitment JSON includes a 0-100 score and the four rationale fields.",
      async test(t) {
        await t.send(
          `Record this complete vendor request and then research it with the fixture JSON below. Requester: Priya Shah. Vendor: Northwind Markets. Service category: drop-copy surveillance. Urgency: high. Security compliance: SOC 2 Type II. Integration specs: modules are market surveillance, FIX support is full. Do not generate an RFP. Fixture: ${fixture}`,
        );
        t.succeeded();
        t.calledTool("research_vendor", { status: "completed", output: fitmentShape });
        t.notCalledTool("generate_rfp");
      },
    },
  ],
});
