import { MongoClient, type Collection, type Db } from "mongodb";

/** Default Atlas database for vendor onboarding stage tracking. */
export const DEFAULT_MONGODB_DB = "vendor_onboarding";

/** Canonical collection: one document per vendor request with embedded stageHistory. */
export const DEFAULT_MONGODB_COLLECTION = "vendor_requests";

export type MongoConfig = {
  uri: string;
  database: string;
  collection: string;
  mock: boolean;
};

export type MongoConfigResult =
  | { ok: true; config: MongoConfig }
  | { ok: false; error: "mongodb_uri_unset"; message: string };

let cachedClient: MongoClient | undefined;
let cachedUri: string | undefined;

/**
 * Read Atlas connection settings from the environment.
 * Names only — never hardcode credentials. Copy from env.example into .env.local.
 */
export function readMongoConfig(): MongoConfigResult {
  const mock = process.env.MONGODB_MOCK === "1" || process.env.MONGODB_MOCK === "true";
  const uri = process.env.MONGODB_URI?.trim() ?? "";
  if (!mock && uri === "") {
    return {
      ok: false,
      error: "mongodb_uri_unset",
      message:
        "MONGODB_URI is unset. Set it in .env.local (see env.example) to persist vendor stages to Atlas. host.kv remains the local cache.",
    };
  }
  return {
    ok: true,
    config: {
      uri: mock ? "mock://vendor-onboarding" : uri,
      database: process.env.MONGODB_DB?.trim() || DEFAULT_MONGODB_DB,
      collection: process.env.MONGODB_COLLECTION?.trim() || DEFAULT_MONGODB_COLLECTION,
      mock,
    },
  };
}

export async function getMongoDb(config: MongoConfig): Promise<Db> {
  if (config.mock) {
    throw new Error("getMongoDb is not used in mock mode");
  }
  if (cachedClient === undefined || cachedUri !== config.uri) {
    if (cachedClient !== undefined) {
      await cachedClient.close().catch(() => undefined);
    }
    // BDK serve is a long-running host: small pool, release idle sockets.
    cachedClient = new MongoClient(config.uri, {
      maxPoolSize: 5,
      minPoolSize: 0,
      maxIdleTimeMS: 30_000,
      serverSelectionTimeoutMS: 8_000,
      connectTimeoutMS: 8_000,
    });
    cachedUri = config.uri;
    await cachedClient.connect();
  }
  return cachedClient.db(config.database);
}

export async function getVendorCollection(config: MongoConfig): Promise<Collection> {
  const db = await getMongoDb(config);
  return db.collection(config.collection);
}

/** Test/helper: drop the cached client (not needed in production). */
export async function closeMongoClient(): Promise<void> {
  if (cachedClient !== undefined) {
    await cachedClient.close().catch(() => undefined);
    cachedClient = undefined;
    cachedUri = undefined;
  }
}
