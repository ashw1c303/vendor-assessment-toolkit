import type { HostMcpCallResult, HostMcpRegistry } from "@cursor/bdk";
import type { ResearchFixtureInput } from "./schemas.js";
import type { ResearchSignals } from "./documents.js";

export type ResearchGather =
  | { ok: true; signals: ResearchSignals }
  | { ok: false; error: "research_unavailable"; message: string };

function clampText(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

function fromFixture(fixture: ResearchFixtureInput): ResearchSignals {
  const sources = (fixture.sources ?? []).map((source) => ({
    title: source.title,
    url: source.url ?? null,
    excerpt: source.excerpt,
  }));
  return {
    summary: fixture.summary,
    publicValue: fixture.publicValue,
    reputation: fixture.reputation,
    source: "fixture",
    sources,
  };
}

function mcpText(result: HostMcpCallResult): string {
  return result.content
    .map((part) => (part.type === "text" && typeof part.text === "string" ? part.text : ""))
    .filter((part) => part !== "")
    .join("\n")
    .trim();
}

type McpSource = { title: string; url: string | null; excerpt: string };

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

/** Turn a Firecrawl or Exa JSON payload into a short summary and sources. */
function formatMcpPayload(text: string): { summary: string; sources: McpSource[] } | undefined {
  try {
    const parsed = asRecord(JSON.parse(text));
    if (parsed === undefined) return undefined;
    if (parsed.success === false) return undefined;
    const data = asRecord(parsed.data) ?? parsed;
    const web = Array.isArray(data.web)
      ? data.web
      : Array.isArray(data.results)
        ? data.results
        : Array.isArray(parsed.results)
          ? parsed.results
          : undefined;
    if (web === undefined || web.length === 0) return undefined;
    const sources: McpSource[] = [];
    for (const item of web.slice(0, 5)) {
      const row = asRecord(item);
      if (row === undefined) continue;
      const title = typeof row.title === "string" ? row.title : typeof row.url === "string" ? row.url : "result";
      const url = typeof row.url === "string" ? row.url : null;
      const excerptSource = row.description ?? row.snippet ?? row.text;
      const excerpt = typeof excerptSource === "string" ? clampText(excerptSource, 400) : "";
      sources.push({ title, url, excerpt });
    }
    if (sources.length === 0) return undefined;
    const summary = sources.map((source, index) => `${index + 1}. ${source.title}. ${source.excerpt}`).join(" ");
    return { summary: clampText(summary, 4000), sources };
  } catch {
    return undefined;
  }
}

function heuristicScores(text: string): { publicValue: number; reputation: number } {
  const lower = text.toLowerCase();
  let reputation = 14;
  if (/breach|lawsuit|indictment|outage|fraud|sanction/.test(lower)) reputation = 6;
  else if (/soc 2|iso 27001|regulated|certified/.test(lower)) reputation = 20;
  let publicValue = 12;
  if (/market|exchange|clearing|surveillance|fix/.test(lower)) publicValue = 18;
  else if (text.length > 80) publicValue = 16;
  return { publicValue, reputation };
}

export async function gatherResearch(
  mcp: HostMcpRegistry,
  query: string,
  fixture: ResearchFixtureInput | undefined,
): Promise<ResearchGather> {
  if (fixture !== undefined) return { ok: true, signals: fromFixture(fixture) };
  if (!mcp.names().includes("research")) {
    return {
      ok: false,
      error: "research_unavailable",
      message:
        "No research fixture was provided and the research MCP connection is not available. Set FIRECRAWL_API_KEY or pass fixture.",
    };
  }
  try {
    const tools = await mcp.listTools("research");
    const search = tools.find((tool) => /search/i.test(tool.name)) ?? tools[0];
    if (search === undefined) {
      return {
        ok: false,
        error: "research_unavailable",
        message: "The research connection exposed no tools. Pass fixture or check the Firecrawl key.",
      };
    }
    let result = await mcp.callTool("research", search.name, { query, limit: 5 });
    if (result.isError === true) {
      result = await mcp.callTool("research", search.name, { query });
    }
    const text = mcpText(result);
    const formatted = formatMcpPayload(text);
    const providerError = formatted === undefined && /"success"\s*:\s*false/.test(text);
    if (result.isError === true || text === "" || providerError) {
      return {
        ok: false,
        error: "research_unavailable",
        message: "The research connection returned no usable text. Pass fixture or retry when Firecrawl is healthy.",
      };
    }
    const summary = formatted?.summary ?? clampText(text, 4000);
    const scores = heuristicScores(summary);
    return {
      ok: true,
      signals: {
        summary,
        publicValue: scores.publicValue,
        reputation: scores.reputation,
        source: "mcp",
        sources: formatted?.sources ?? [{ title: search.name, url: null, excerpt: clampText(text, 800) }],
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "research connection failed";
    return {
      ok: false,
      error: "research_unavailable",
      message: `Research MCP call failed (${message}). Pass fixture or set FIRECRAWL_API_KEY.`,
    };
  }
}
