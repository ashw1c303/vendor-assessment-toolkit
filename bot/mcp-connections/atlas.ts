import { defineConnection } from "@cursor/bdk/connections";

/**
 * MongoDB Atlas MCP for Cursor / Grok query of vendor stage documents.
 * Never name an account connection file `cursor.ts`.
 *
 * Credentials come from the environment at connect time (`${MONGODB_URI}`),
 * never from source. Optional so local serve and smoke evals still boot when
 * Atlas is unset — durable writes go through bot/lib/vendor-store.ts when
 * MONGODB_URI (or MONGODB_MOCK=1) is configured.
 *
 * Docs: https://www.mongodb.com/docs/mcp-server/
 */
export default defineConnection({
  command: "npx",
  args: ["-y", "mongodb-mcp-server@latest"],
  env: {
    MDB_MCP_CONNECTION_STRING: "${MONGODB_URI}",
  },
  advertiseTools: true,
  optional: true,
});
