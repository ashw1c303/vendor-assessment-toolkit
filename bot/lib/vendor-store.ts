import type { HostKvApi } from "@cursor/bdk";
import {
  createRequest,
  getRequest,
  listRequests,
  readLeadership,
  saveLeadership,
  saveRequest,
  updateRequest,
  type LeadershipSnapshot,
  type RequestStatus,
  type StoreResult,
  type VendorRequest,
} from "./record.js";
import {
  DEFAULT_MONGODB_COLLECTION,
  DEFAULT_MONGODB_DB,
  getVendorCollection,
  readMongoConfig,
  type MongoConfig,
} from "./mongo.js";
import type { RecordVendorInput, UpdateVendorInput } from "./schemas.js";

export type StageEvent = {
  status: RequestStatus;
  at: string;
  note?: string;
};

/** Atlas document: vendor request fields plus embedded stage history. */
export type VendorAtlasDocument = VendorRequest & {
  requestId: string;
  stageHistory: StageEvent[];
  atlasUpdatedAt: string;
};

export type AtlasPersistResult =
  | {
      ok: true;
      persisted: true;
      database: string;
      collection: string;
      requestId: string;
      status: RequestStatus;
      stageHistoryLength: number;
      mock: boolean;
    }
  | {
      ok: false;
      persisted: false;
      error: string;
      message: string;
      database: string;
      collection: string;
    };

export type PersistOptions = {
  /** Optional stage note (e.g. decision, follow-up). */
  note?: string;
  /** Previous status before this write (avoids a Mongo round-trip when known). */
  previousStatus?: RequestStatus | null;
};

const mockStore = new Map<string, VendorAtlasDocument>();

function atlasTargets(config?: MongoConfig): { database: string; collection: string } {
  return {
    database: config?.database ?? (process.env.MONGODB_DB?.trim() || DEFAULT_MONGODB_DB),
    collection: config?.collection ?? (process.env.MONGODB_COLLECTION?.trim() || DEFAULT_MONGODB_COLLECTION),
  };
}

/**
 * Append a stage event when status is new or changed.
 * Stage history is bounded (one entry per transition); vendor pipelines are short.
 */
export function nextStageHistory(
  existing: StageEvent[] | undefined,
  status: RequestStatus,
  at: string,
  note: string | undefined,
  previousStatus: RequestStatus | null | undefined,
): StageEvent[] {
  const history = existing === undefined ? [] : [...existing];
  const last = history[history.length - 1];
  const statusChanged =
    previousStatus !== undefined && previousStatus !== null
      ? previousStatus !== status
      : last === undefined || last.status !== status;
  if (!statusChanged && last !== undefined) {
    if (note !== undefined && note.trim() !== "" && last.note !== note.trim()) {
      const updated = [...history];
      updated[updated.length - 1] = { ...last, note: note.trim() };
      return updated;
    }
    return history;
  }
  const event: StageEvent = { status, at };
  if (note !== undefined && note.trim() !== "") event.note = note.trim();
  history.push(event);
  return history;
}

export function toAtlasDocument(
  request: VendorRequest,
  stageHistory: StageEvent[],
  atlasUpdatedAt: string,
): VendorAtlasDocument {
  return {
    ...request,
    requestId: request.id,
    stageHistory,
    atlasUpdatedAt,
  };
}

async function upsertAtlasDocument(
  config: MongoConfig,
  document: VendorAtlasDocument,
): Promise<void> {
  if (config.mock) {
    mockStore.set(document.requestId, document);
    return;
  }
  const collection = await getVendorCollection(config);
  await collection.updateOne(
    { requestId: document.requestId },
    { $set: document },
    { upsert: true },
  );
}

async function loadExistingHistory(
  config: MongoConfig,
  requestId: string,
): Promise<StageEvent[] | undefined> {
  if (config.mock) {
    return mockStore.get(requestId)?.stageHistory;
  }
  const collection = await getVendorCollection(config);
  const existing = await collection.findOne(
    { requestId },
    { projection: { stageHistory: 1 } },
  );
  if (existing === null || !Array.isArray(existing.stageHistory)) return undefined;
  return existing.stageHistory as StageEvent[];
}

/**
 * Persist a vendor request to MongoDB Atlas (or in-process mock).
 * Degrades with a clear JSON error when MONGODB_URI is unset and mock is off.
 */
export async function persistToAtlas(
  request: VendorRequest,
  options: PersistOptions = {},
): Promise<AtlasPersistResult> {
  const targets = atlasTargets();
  const configured = readMongoConfig();
  if (!configured.ok) {
    return {
      ok: false,
      persisted: false,
      error: configured.error,
      message: configured.message,
      database: targets.database,
      collection: targets.collection,
    };
  }
  const { config } = configured;
  try {
    const existingHistory = await loadExistingHistory(config, request.id);
    const stageHistory = nextStageHistory(
      existingHistory,
      request.status,
      request.updatedAt,
      options.note,
      options.previousStatus,
    );
    const document = toAtlasDocument(request, stageHistory, new Date().toISOString());
    await upsertAtlasDocument(config, document);
    return {
      ok: true,
      persisted: true,
      database: config.database,
      collection: config.collection,
      requestId: request.id,
      status: request.status,
      stageHistoryLength: stageHistory.length,
      mock: config.mock,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "atlas_persist_failed";
    return {
      ok: false,
      persisted: false,
      error: "atlas_persist_failed",
      message,
      database: config.database,
      collection: config.collection,
    };
  }
}

/** host.kv write + Atlas upsert. Atlas failure does not roll back kv. */
export async function saveVendorRequest(
  kv: HostKvApi,
  request: VendorRequest,
  options: PersistOptions = {},
): Promise<{ request: VendorRequest; atlas: AtlasPersistResult }> {
  await saveRequest(kv, request);
  const atlas = await persistToAtlas(request, options);
  return { request, atlas };
}

export async function createVendorRequest(
  kv: HostKvApi,
  patch: RecordVendorInput,
  now: string,
): Promise<{ request: VendorRequest; atlas: AtlasPersistResult }> {
  const request = await createRequest(kv, patch, now);
  const atlas = await persistToAtlas(request, { note: "intake", previousStatus: null });
  return { request, atlas };
}

export async function updateVendorRequest(
  kv: HostKvApi,
  patch: UpdateVendorInput,
  now: string,
): Promise<{ result: StoreResult; atlas: AtlasPersistResult | null }> {
  const previous = await getRequest(kv, patch.requestId);
  const result = await updateRequest(kv, patch, now);
  if (!result.ok) return { result, atlas: null };
  const note = patch.followUpNote?.trim() || "collection_update";
  const atlas = await persistToAtlas(result.request, {
    note,
    previousStatus: previous?.status ?? null,
  });
  return { result, atlas };
}

export async function getVendorRequest(
  kv: HostKvApi,
  id: string,
): Promise<VendorRequest | undefined> {
  return getRequest(kv, id);
}

export async function listVendorRequests(kv: HostKvApi): Promise<VendorRequest[]> {
  return listRequests(kv);
}

export async function saveLeadershipSnapshot(
  kv: HostKvApi,
  snapshot: LeadershipSnapshot,
): Promise<void> {
  await saveLeadership(kv, snapshot);
}

export async function readLeadershipSnapshot(
  kv: HostKvApi,
): Promise<LeadershipSnapshot | undefined> {
  return readLeadership(kv);
}

/** Clear the in-process mock store (evals / local smoke). */
export function clearAtlasMockStore(): void {
  mockStore.clear();
}

/** Read a mock document when MONGODB_MOCK is enabled. */
export function getAtlasMockDocument(requestId: string): VendorAtlasDocument | undefined {
  return mockStore.get(requestId);
}
