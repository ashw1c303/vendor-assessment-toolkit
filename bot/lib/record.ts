import { supportsKvCas, type HostKvApi, type JsonValue } from "@cursor/bdk";
import { normalizeFixSupport, normalizeModuleList } from "./architecture.js";
import type { RecordVendorInput, UpdateVendorInput } from "./schemas.js";

export const REQUEST_STATUSES = [
  "intake",
  "collecting",
  "researched",
  "awaiting_approval",
  "approved",
  "rejected",
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUIRED_FIELDS = [
  "requesterName",
  "vendorName",
  "serviceCategory",
  "urgency",
  "securityCompliance",
  "integrationSpecs.modules",
  "integrationSpecs.fixSupport",
] as const;

export type RequiredField = (typeof REQUIRED_FIELDS)[number];

export type IntegrationSpecs = {
  modules: string[];
  fixSupport: string;
  notes: string;
};

export type FitmentBreakdown = {
  publicValue: number;
  reputation: number;
  fixCompatibility: number;
  moduleOverlap: number;
};

export type FitmentRationale = {
  publicValue: string;
  reputation: string;
  fixCompatibility: string;
  moduleOverlap: string;
  guidelinesCited: string[];
  breakdown: FitmentBreakdown;
};

export type VendorRequest = {
  id: string;
  requesterName: string | null;
  vendorName: string | null;
  serviceCategory: string | null;
  urgency: string | null;
  securityCompliance: string | null;
  integrationSpecs: IntegrationSpecs | null;
  status: RequestStatus;
  missingFields: string[];
  fitmentScore: number | null;
  fitmentRationale: FitmentRationale | null;
  researchSummary: string | null;
  architectureBrief: string | null;
  plantUml: string | null;
  rfp: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StoreSuccess = { ok: true; request: VendorRequest };
export type StoreFailure = { ok: false; error: string; request: VendorRequest | null };
export type StoreResult = StoreSuccess | StoreFailure;

export type FollowUp = {
  ok: true;
  requestId: string;
  vendorName: string | null;
  missingFields: string[];
  advancedToResearch: false;
  message: string;
};

const INDEX_KEY = "vendor-requests/index";
const LEADERSHIP_KEY = "leadership/latest";

const FIELD_PROMPTS: Record<string, string> = {
  requesterName: "Requester name",
  vendorName: "Vendor name",
  serviceCategory: "Proposed service category",
  urgency: "Urgency (low, medium, high, or critical)",
  securityCompliance: "Security compliance (for example SOC 2 or ISO 27001)",
  "integrationSpecs.modules":
    "Acme modules touched (trade matching, market surveillance, and/or clearing)",
  "integrationSpecs.fixSupport": "FIX support (full, partial, or none)",
  "follow-up": "The additional information the reviewer asked for",
};

function recordKey(id: string): string {
  return `vendor-requests/${id}`;
}

function blank(value: string | null | undefined): boolean {
  return typeof value !== "string" || value.trim() === "";
}

function clean(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function structuralMissing(record: Pick<VendorRequest, "requesterName" | "vendorName" | "serviceCategory" | "urgency" | "securityCompliance" | "integrationSpecs">): string[] {
  const missing: string[] = [];
  if (blank(record.requesterName)) missing.push("requesterName");
  if (blank(record.vendorName)) missing.push("vendorName");
  if (blank(record.serviceCategory)) missing.push("serviceCategory");
  if (blank(record.urgency)) missing.push("urgency");
  if (blank(record.securityCompliance)) missing.push("securityCompliance");
  if (record.integrationSpecs === null || record.integrationSpecs.modules.length === 0) {
    missing.push("integrationSpecs.modules");
  }
  if (record.integrationSpecs === null || blank(record.integrationSpecs.fixSupport)) {
    missing.push("integrationSpecs.fixSupport");
  }
  return missing;
}

function unique(values: string[]): string[] {
  const out: string[] = [];
  for (const value of values) {
    if (!out.includes(value)) out.push(value);
  }
  return out;
}

function emptyRequest(id: string, now: string): VendorRequest {
  return {
    id,
    requesterName: null,
    vendorName: null,
    serviceCategory: null,
    urgency: null,
    securityCompliance: null,
    integrationSpecs: null,
    status: "intake",
    missingFields: [...REQUIRED_FIELDS],
    fitmentScore: null,
    fitmentRationale: null,
    researchSummary: null,
    architectureBrief: null,
    plantUml: null,
    rfp: null,
    createdAt: now,
    updatedAt: now,
  };
}

function applySpecs(
  current: IntegrationSpecs | null,
  patch: NonNullable<RecordVendorInput["integrationSpecs"]> | undefined,
  followUpNote: string | undefined,
): IntegrationSpecs | null {
  const note = clean(followUpNote);
  if (patch === undefined && note === null) return current;
  const base = current ?? { modules: [], fixSupport: "", notes: "" };
  const notes = [base.notes, note === null ? "" : `Follow-up: ${note}`].filter((part) => part !== "").join("\n");
  if (patch === undefined) {
    return { ...base, notes };
  }
  return {
    modules: patch.modules === undefined ? base.modules : normalizeModuleList(patch.modules),
    fixSupport:
      patch.fixSupport === undefined ? base.fixSupport : normalizeFixSupport(patch.fixSupport),
    notes: patch.notes === undefined ? notes : [clean(patch.notes) ?? "", note === null ? "" : `Follow-up: ${note}`]
      .filter((part) => part !== "")
      .join("\n"),
  };
}

function addressedBy(patch: UpdateVendorInput | RecordVendorInput, followUpNote: string | undefined): Set<string> {
  const addressed = new Set<string>();
  if (!blank(patch.requesterName)) addressed.add("requesterName");
  if (!blank(patch.vendorName)) addressed.add("vendorName");
  if (!blank(patch.serviceCategory)) addressed.add("serviceCategory");
  if (!blank(patch.urgency)) addressed.add("urgency");
  if (!blank(patch.securityCompliance)) addressed.add("securityCompliance");
  if (patch.integrationSpecs?.modules !== undefined && normalizeModuleList(patch.integrationSpecs.modules).length > 0) {
    addressed.add("integrationSpecs.modules");
  }
  if (patch.integrationSpecs?.fixSupport !== undefined && !blank(normalizeFixSupport(patch.integrationSpecs.fixSupport))) {
    addressed.add("integrationSpecs.fixSupport");
  }
  if (!blank(followUpNote)) addressed.add("follow-up");
  return addressed;
}

function merge(record: VendorRequest, patch: RecordVendorInput, followUpNote?: string): VendorRequest {
  const integrationSpecs = applySpecs(record.integrationSpecs, patch.integrationSpecs, followUpNote);
  const next: VendorRequest = {
    ...record,
    requesterName: patch.requesterName === undefined ? record.requesterName : clean(patch.requesterName),
    vendorName: patch.vendorName === undefined ? record.vendorName : clean(patch.vendorName),
    serviceCategory: patch.serviceCategory === undefined ? record.serviceCategory : clean(patch.serviceCategory),
    urgency: patch.urgency === undefined ? record.urgency : clean(patch.urgency),
    securityCompliance:
      patch.securityCompliance === undefined ? record.securityCompliance : clean(patch.securityCompliance),
    integrationSpecs,
  };
  const addressed = addressedBy(patch, followUpNote);
  const structural = structuralMissing(next);
  const blockers = record.missingFields.filter((field) => !addressed.has(field) && !structural.includes(field));
  next.missingFields = unique([...structural, ...blockers]);
  return next;
}

function materialChange(before: VendorRequest, after: VendorRequest): boolean {
  return (
    before.vendorName !== after.vendorName ||
    before.serviceCategory !== after.serviceCategory ||
    before.securityCompliance !== after.securityCompliance ||
    JSON.stringify(before.integrationSpecs) !== JSON.stringify(after.integrationSpecs)
  );
}

function clearAssessment(record: VendorRequest): VendorRequest {
  return {
    ...record,
    fitmentScore: null,
    fitmentRationale: null,
    researchSummary: null,
    architectureBrief: null,
    plantUml: null,
    rfp: null,
  };
}

function resolveStatus(before: VendorRequest, merged: VendorRequest): VendorRequest {
  const material = materialChange(before, merged);
  let next = material ? clearAssessment(merged) : merged;
  if (next.missingFields.length > 0) {
    next = { ...next, status: "collecting" };
  } else if (next.architectureBrief !== null && next.fitmentScore !== null) {
    next = { ...next, status: "awaiting_approval" };
  } else if (next.fitmentScore !== null) {
    next = { ...next, status: "researched" };
  } else {
    next = { ...next, status: "intake" };
  }
  return next;
}

function asJson(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function isObject(value: JsonValue | undefined): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStringList(value: JsonValue | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseSpecs(value: JsonValue | undefined): IntegrationSpecs | null {
  if (!isObject(value)) return null;
  return {
    modules: parseStringList(value.modules),
    fixSupport: typeof value.fixSupport === "string" ? value.fixSupport : "",
    notes: typeof value.notes === "string" ? value.notes : "",
  };
}

function parseBreakdown(value: JsonValue | undefined): FitmentBreakdown | null {
  if (!isObject(value)) return null;
  const keys = ["publicValue", "reputation", "fixCompatibility", "moduleOverlap"] as const;
  const breakdown = { publicValue: 0, reputation: 0, fixCompatibility: 0, moduleOverlap: 0 };
  for (const key of keys) {
    const score = value[key];
    if (typeof score !== "number") return null;
    breakdown[key] = score;
  }
  return breakdown;
}

function parseRationale(value: JsonValue | undefined): FitmentRationale | null {
  if (!isObject(value)) return null;
  const breakdown = parseBreakdown(value.breakdown);
  if (
    breakdown === null ||
    typeof value.publicValue !== "string" ||
    typeof value.reputation !== "string" ||
    typeof value.fixCompatibility !== "string" ||
    typeof value.moduleOverlap !== "string"
  ) {
    return null;
  }
  return {
    publicValue: value.publicValue,
    reputation: value.reputation,
    fixCompatibility: value.fixCompatibility,
    moduleOverlap: value.moduleOverlap,
    guidelinesCited: parseStringList(value.guidelinesCited),
    breakdown,
  };
}

export function parseRequest(value: JsonValue | undefined): VendorRequest | undefined {
  if (!isObject(value) || typeof value.id !== "string") return undefined;
  const status = value.status;
  if (typeof status !== "string" || !REQUEST_STATUSES.includes(status as RequestStatus)) return undefined;
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString();
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : createdAt;
  return {
    id: value.id,
    requesterName: typeof value.requesterName === "string" ? value.requesterName : null,
    vendorName: typeof value.vendorName === "string" ? value.vendorName : null,
    serviceCategory: typeof value.serviceCategory === "string" ? value.serviceCategory : null,
    urgency: typeof value.urgency === "string" ? value.urgency : null,
    securityCompliance: typeof value.securityCompliance === "string" ? value.securityCompliance : null,
    integrationSpecs: parseSpecs(value.integrationSpecs),
    status: status as RequestStatus,
    missingFields: parseStringList(value.missingFields),
    fitmentScore: typeof value.fitmentScore === "number" ? value.fitmentScore : null,
    fitmentRationale: parseRationale(value.fitmentRationale),
    researchSummary: typeof value.researchSummary === "string" ? value.researchSummary : null,
    architectureBrief: typeof value.architectureBrief === "string" ? value.architectureBrief : null,
    plantUml: typeof value.plantUml === "string" ? value.plantUml : null,
    rfp: typeof value.rfp === "string" ? value.rfp : null,
    createdAt,
    updatedAt,
  };
}

async function readIndex(kv: HostKvApi): Promise<string[]> {
  return parseStringList(await kv.get(INDEX_KEY));
}

async function rememberId(kv: HostKvApi, id: string): Promise<void> {
  if (supportsKvCas(kv)) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const current = await kv.getWithVersion(INDEX_KEY);
      const ids = parseStringList(current?.value);
      if (ids.includes(id)) return;
      const next = [...ids, id];
      const result =
        current === undefined
          ? await kv.putIfAbsent(INDEX_KEY, next)
          : await kv.putIfVersion(INDEX_KEY, next, current.version);
      if (result.ok) return;
    }
  }
  const ids = await readIndex(kv);
  if (!ids.includes(id)) await kv.put(INDEX_KEY, [...ids, id]);
}

export async function saveRequest(kv: HostKvApi, request: VendorRequest): Promise<void> {
  await kv.put(recordKey(request.id), asJson(request));
}

export async function getRequest(kv: HostKvApi, id: string): Promise<VendorRequest | undefined> {
  return parseRequest(await kv.get(recordKey(id)));
}

export async function listRequests(kv: HostKvApi): Promise<VendorRequest[]> {
  const ids = await readIndex(kv);
  const requests: VendorRequest[] = [];
  for (const id of ids) {
    const request = await getRequest(kv, id);
    if (request !== undefined) requests.push(request);
  }
  return requests;
}

export async function createRequest(kv: HostKvApi, patch: RecordVendorInput, now: string): Promise<VendorRequest> {
  const id = `vr_${crypto.randomUUID()}`;
  const created = merge(emptyRequest(id, now), patch);
  const request: VendorRequest = {
    ...created,
    status: created.missingFields.length > 0 ? "collecting" : "intake",
    createdAt: now,
    updatedAt: now,
  };
  await saveRequest(kv, request);
  await rememberId(kv, request.id);
  return request;
}

export async function updateRequest(kv: HostKvApi, patch: UpdateVendorInput, now: string): Promise<StoreResult> {
  const current = await getRequest(kv, patch.requestId);
  if (current === undefined) return { ok: false, error: "not_found", request: null };
  if (current.status === "approved" || current.status === "rejected") {
    return { ok: false, error: "record_closed", request: current };
  }
  const merged = resolveStatus(current, merge(current, patch, patch.followUpNote));
  const request = { ...merged, updatedAt: now };
  await saveRequest(kv, request);
  return { ok: true, request };
}

export function researchBlocked(request: VendorRequest): string | undefined {
  if (request.status === "approved" || request.status === "rejected") return "record_closed";
  if (request.missingFields.length > 0) return "required_fields_missing";
  return undefined;
}

export function withResearch(
  request: VendorRequest,
  scored: {
    fitmentScore: number;
    fitmentRationale: FitmentRationale;
    researchSummary: string;
  },
  now: string,
): VendorRequest {
  return {
    ...request,
    status: "researched",
    fitmentScore: scored.fitmentScore,
    fitmentRationale: scored.fitmentRationale,
    researchSummary: scored.researchSummary,
    architectureBrief: null,
    plantUml: null,
    rfp: null,
    updatedAt: now,
  };
}

export function withBrief(request: VendorRequest, brief: string, plantUml: string, now: string): VendorRequest {
  return {
    ...request,
    status: "awaiting_approval",
    architectureBrief: brief,
    plantUml,
    updatedAt: now,
  };
}

export type ApprovalDecision = "approve" | "reject" | "needs-more-info";

export function withDecision(
  request: VendorRequest,
  decision: ApprovalDecision,
  fields: string[] | undefined,
  now: string,
): StoreResult {
  if (decision === "approve") {
    if (request.status !== "awaiting_approval") {
      return { ok: false, error: "approve_requires_awaiting_approval", request };
    }
    return { ok: true, request: { ...request, status: "approved", missingFields: [], updatedAt: now } };
  }
  if (decision === "reject") {
    if (request.status === "rejected") return { ok: true, request };
    return { ok: true, request: { ...request, status: "rejected", updatedAt: now } };
  }
  if (request.status === "rejected" || request.status === "approved") {
    return { ok: false, error: "record_closed", request };
  }
  const requested = (fields ?? []).map((field) => field.trim()).filter((field) => field !== "");
  const missingFields = unique([...request.missingFields, ...(requested.length > 0 ? requested : ["follow-up"])]);
  return {
    ok: true,
    request: { ...request, status: "collecting", missingFields, updatedAt: now },
  };
}

export function withRfp(request: VendorRequest, rfp: string, now: string): VendorRequest {
  return { ...request, rfp, updatedAt: now };
}

export function draftFollowUp(request: VendorRequest): FollowUp {
  if (request.missingFields.length === 0) {
    return {
      ok: true,
      requestId: request.id,
      vendorName: request.vendorName,
      missingFields: [],
      advancedToResearch: false,
      message: `Request ${request.id} has every field required before research. This follow-up does not start research.`,
    };
  }
  const who = request.requesterName ?? "there";
  const vendor = request.vendorName ?? "this vendor";
  const lines = request.missingFields.map((field) => `- ${FIELD_PROMPTS[field] ?? field}`);
  return {
    ok: true,
    requestId: request.id,
    vendorName: request.vendorName,
    missingFields: [...request.missingFields],
    advancedToResearch: false,
    message: [
      `${who}, I have ${vendor} on request ${request.id}.`,
      "I still need only the following before research can start:",
      ...lines,
      "Reply with those items and nothing else.",
    ].join("\n"),
  };
}

export type LeadershipSnapshot = {
  summary: string;
  approvedCount: number;
  requestIds: string[];
  generatedAt: string;
  source: string;
  posted: boolean;
  postReason: string | null;
};

export async function saveLeadership(kv: HostKvApi, snapshot: LeadershipSnapshot): Promise<void> {
  await kv.put(LEADERSHIP_KEY, asJson(snapshot));
}

export async function readLeadership(kv: HostKvApi): Promise<LeadershipSnapshot | undefined> {
  const value = await kv.get(LEADERSHIP_KEY);
  if (!isObject(value) || typeof value.summary !== "string") return undefined;
  return {
    summary: value.summary,
    approvedCount: typeof value.approvedCount === "number" ? value.approvedCount : 0,
    requestIds: parseStringList(value.requestIds),
    generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : "",
    source: typeof value.source === "string" ? value.source : "tool",
    posted: value.posted === true,
    postReason: typeof value.postReason === "string" ? value.postReason : null,
  };
}
