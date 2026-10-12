import { defineEval } from "@cursor/bdk/evals";

function atlasUnsetOrPersisted(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const record = value as {
    ok?: boolean;
    atlas?: {
      ok?: boolean;
      persisted?: boolean;
      error?: string;
      database?: string;
      collection?: string;
      stageHistoryLength?: number;
    };
  };
  if (record.ok !== true || typeof record.atlas !== "object" || record.atlas === null) return false;
  const atlas = record.atlas;
  if (atlas.persisted === true) {
    return (
      atlas.ok === true &&
      typeof atlas.database === "string" &&
      typeof atlas.collection === "string" &&
      typeof atlas.stageHistoryLength === "number" &&
      atlas.stageHistoryLength >= 1
    );
  }
  return atlas.ok === false && atlas.error === "mongodb_uri_unset";
}

export default defineEval({
  tags: ["smoke", "atlas"],
  cases: [
    {
      id: "intake-persists-atlas-meta",
      description:
        "Intake returns atlas persistence metadata (persisted when URI/mock set, else mongodb_uri_unset).",
      async test(t) {
        await t.send(
          "Priya Shah submitted a vendor request. The vendor is Northwind Markets. Proposed service category: drop-copy surveillance. Urgency: high. Record that request and do not research it.",
        );
        t.succeeded();
        t.calledTool("record_vendor_request", {
          output: atlasUnsetOrPersisted,
        });
        t.notCalledTool("research_vendor");
      },
    },
  ],
});
