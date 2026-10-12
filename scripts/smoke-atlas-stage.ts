/**
 * Smoke: record a stage transition through the Atlas vendor store.
 * Uses MONGODB_MOCK=1 so CI / local runs need no live URI.
 *
 *   MONGODB_MOCK=1 npx tsx scripts/smoke-atlas-stage.ts
 */
import assert from "node:assert/strict";
import {
  clearAtlasMockStore,
  getAtlasMockDocument,
  nextStageHistory,
  persistToAtlas,
} from "../bot/lib/vendor-store.js";
import type { VendorRequest } from "../bot/lib/record.js";

process.env.MONGODB_MOCK = "1";
clearAtlasMockStore();

const now = new Date().toISOString();
const base: VendorRequest = {
  id: "vr_smoke_atlas",
  requesterName: "Priya Shah",
  vendorName: "Northwind Markets",
  serviceCategory: "drop-copy surveillance",
  urgency: "high",
  securityCompliance: null,
  integrationSpecs: null,
  status: "collecting",
  missingFields: ["securityCompliance", "integrationSpecs.modules", "integrationSpecs.fixSupport"],
  fitmentScore: null,
  fitmentRationale: null,
  researchSummary: null,
  architectureBrief: null,
  plantUml: null,
  rfp: null,
  createdAt: now,
  updatedAt: now,
};

const first = await persistToAtlas(base, { note: "intake", previousStatus: null });
assert.equal(first.ok, true);
assert.equal(first.persisted, true);
if (first.ok) {
  assert.equal(first.database, "vendor_onboarding");
  assert.equal(first.collection, "vendor_requests");
  assert.equal(first.stageHistoryLength, 1);
  assert.equal(first.mock, true);
}

const researched: VendorRequest = {
  ...base,
  status: "researched",
  securityCompliance: "SOC 2 Type II",
  integrationSpecs: { modules: ["market surveillance"], fixSupport: "full", notes: "" },
  missingFields: [],
  fitmentScore: 72,
  updatedAt: new Date().toISOString(),
};

const second = await persistToAtlas(researched, {
  note: "research_complete",
  previousStatus: "collecting",
});
assert.equal(second.ok, true);
if (second.ok) assert.equal(second.stageHistoryLength, 2);

const doc = getAtlasMockDocument("vr_smoke_atlas");
assert.ok(doc);
assert.equal(doc.status, "researched");
assert.equal(doc.stageHistory.length, 2);
assert.equal(doc.stageHistory[0]?.status, "collecting");
assert.equal(doc.stageHistory[1]?.status, "researched");
assert.equal(doc.stageHistory[1]?.note, "research_complete");

const history = nextStageHistory(doc.stageHistory, "researched", now, undefined, "researched");
assert.equal(history.length, 2, "same status must not append a duplicate stage");

console.log(
  JSON.stringify(
    {
      ok: true,
      database: first.ok ? first.database : null,
      collection: first.ok ? first.collection : null,
      requestId: "vr_smoke_atlas",
      stages: doc.stageHistory.map((event) => event.status),
    },
    null,
    2,
  ),
);
