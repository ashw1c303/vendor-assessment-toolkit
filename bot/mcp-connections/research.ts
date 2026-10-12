import { defineConnection } from "@cursor/bdk/connections";

/**
 * Research MCP. Firecrawl is preferred. The key is read from the environment
 * when the connection opens (`${FIRECRAWL_API_KEY}`), never from source.
 *
 * Exa is an acceptable replacement. Point this file at Exa instead:
 *   url: "https://mcp.exa.ai/mcp"
 *   headers: { "x-api-key": "${EXA_API_KEY}" }
 * Keep `advertiseTools` and `optional` so a missing key does not fail turns.
 * Local runs and evals pass a research fixture and do not need either key.
 */
export default defineConnection({
  url: "https://mcp.firecrawl.dev/v2/mcp",
  headers: {
    authorization: "Bearer ${FIRECRAWL_API_KEY}",
  },
  advertiseTools: true,
  optional: true,
  disallowedTools: ["firecrawl_crawl", "firecrawl_agent"],
});
