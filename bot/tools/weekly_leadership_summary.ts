import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { leadershipSummary } from "../lib/documents.js";
import { listRequests, readLeadership, saveLeadership, type LeadershipSnapshot } from "../lib/record.js";

const EXEC_CHANNEL = "VENDOR_ONBOARDING_EXEC_SLACK_CHANNEL";

async function postSummary(ctx: { host: { slack: { getClient: () => Promise<{ chat: { postMessage: (args: { channel: string; text: string }) => Promise<unknown> } }> } } }, summary: string): Promise<{ posted: boolean; postReason: string | null }> {
  const channel = process.env[EXEC_CHANNEL]?.trim();
  if (channel === undefined || channel === "") {
    return { posted: false, postReason: "slack_channel_unset" };
  }
  try {
    const client = await ctx.host.slack.getClient();
    await client.chat.postMessage({ channel, text: summary });
    return { posted: true, postReason: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "slack post failed";
    return { posted: false, postReason: message };
  }
}

export default defineTool({
  description: prompt`
    Aggregate approved vendor requests into a Business Value Proposition
    for leadership: strategic fit with clearing and exchange goals, cost
    signals, and competitive notes. Pass source "schedule" from the Monday
    job and source "read" to return the last summary without regenerating.
    When Slack is not configured, the tool result is the summary.
  `,
  effect: (input) => (input.source === "read" ? "read" : "write"),
  inputSchema: z.object({
    source: z.enum(["tool", "schedule", "read"]).optional(),
  }),
  async execute(input, ctx) {
    const source = input.source ?? "tool";
    if (source === "read") {
      const stored = await readLeadership(ctx.host.kv);
      if (stored === undefined) return { ok: false as const, error: "no_summary" };
      return { ok: true as const, ...stored };
    }
    const requests = await listRequests(ctx.host.kv);
    const built = leadershipSummary(requests, new Date().toISOString());
    const delivery = await postSummary(ctx, built.summary);
    const snapshot: LeadershipSnapshot = {
      summary: built.summary,
      approvedCount: built.approvedCount,
      requestIds: built.requestIds,
      generatedAt: new Date().toISOString(),
      source,
      posted: delivery.posted,
      postReason: delivery.postReason,
    };
    await saveLeadership(ctx.host.kv, snapshot);
    return { ok: true as const, ...snapshot };
  },
});
