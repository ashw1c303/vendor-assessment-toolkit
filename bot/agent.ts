import { defineAgent } from "@cursor/bdk";

export default defineAgent({
  name: "Vendor Onboarding",
  description:
    "Onboards vendors onto Acme's trade matching, clearing, and market surveillance exchange.",
  model: {
    id: "grok-4.5",
    params: [
      { id: "effort", value: "high" },
      { id: "fast", value: "true" },
    ],
  },
  // Authored server tools arrive through MCP. `task` is the subagent fan-out.
  tools: ["task"],
  local: {
    sandbox: true,
  },
});
