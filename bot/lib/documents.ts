import {
  ACME_MODULES,
  GUIDELINES,
  clampQuarter,
  fixScore,
  generatePlantUml,
  overlapScore,
  recognizedModules,
} from "./architecture.js";
import type { FitmentRationale, VendorRequest } from "./record.js";

export type ResearchSignals = {
  summary: string;
  publicValue: number;
  reputation: number;
  source: "fixture" | "mcp";
  sources: { title: string; url: string | null; excerpt: string }[];
};

function clip(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export function scoreFitment(request: VendorRequest, signals: ResearchSignals): {
  fitmentScore: number;
  fitmentRationale: FitmentRationale;
  researchSummary: string;
} {
  const specs = request.integrationSpecs;
  const modules = specs?.modules ?? [];
  const fixSupport = specs?.fixSupport ?? "";
  const publicValue = clampQuarter(signals.publicValue);
  const reputation = clampQuarter(signals.reputation);
  const fixCompatibility = fixScore(fixSupport);
  const moduleOverlap = overlapScore(modules);
  const fitmentScore = publicValue + reputation + fixCompatibility + moduleOverlap;
  const recognized = recognizedModules(modules);
  const unrecognized = modules.filter((module) => module.startsWith("other:"));
  const guidelinesCited = [
    "capability-overlap",
    "fix-compatibility",
    ...recognized,
  ];
  const sourceLines = signals.sources.map((source) => {
    const where = source.url === null ? source.title : `${source.title} (${source.url})`;
    return `- ${where}: ${clip(source.excerpt, 400)}`;
  });
  const researchSummary = [
    clip(signals.summary, 4000),
    `Research source: ${signals.source}.`,
    sourceLines.length > 0 ? "Sources:" : "",
    ...sourceLines,
  ]
    .filter((line) => line !== "")
    .join("\n");
  const fitmentRationale: FitmentRationale = {
    publicValue: `Public value ${publicValue}/25. ${clip(signals.summary, 500)} This is judged against Acme's exchange goals, not a live vector index.`,
    reputation: `Reputation ${reputation}/25 from ${signals.source} evidence. ${sourceLines.slice(0, 3).join(" ") || "No separate source excerpts were attached."}`,
    fixCompatibility: `FIX compatibility ${fixCompatibility}/25. Reported support is "${fixSupport || "missing"}". ${GUIDELINES.find((item) => item.id === "fix-compatibility")?.body ?? ""}`,
    moduleOverlap: `Overlap ${moduleOverlap}/25. Recognized Acme modules: ${recognized.join(", ") || "none"}. ${unrecognized.length > 0 ? `Unmapped: ${unrecognized.join(", ")}.` : "No unmapped modules."} ${GUIDELINES.find((item) => item.id === "capability-overlap")?.body ?? ""}`,
    guidelinesCited,
    breakdown: { publicValue, reputation, fixCompatibility, moduleOverlap },
  };
  return { fitmentScore, fitmentRationale, researchSummary };
}

export type BriefNotes = {
  publicResearch?: string;
  internalFit?: string;
  integrationRisk?: string;
  plantUml?: string;
};

export function compileBrief(request: VendorRequest, notes: BriefNotes): { markdown: string; plantUml: string } {
  const specs = request.integrationSpecs;
  const modules = specs?.modules ?? [];
  const fixSupport = specs?.fixSupport ?? "";
  const provided = notes.plantUml?.trim();
  const plantUml =
    provided !== undefined && provided.includes("@startuml")
      ? provided
      : generatePlantUml({
          vendorName: request.vendorName ?? "Vendor",
          serviceCategory: request.serviceCategory ?? "unspecified",
          modules,
          fixSupport,
        });
  const risks = ACME_MODULES.map((module) => {
    const touched = modules.includes(module.id);
    return `### ${module.title}\n${touched ? module.touched : module.untouched}`;
  }).join("\n\n");
  const publicResearch = clip(notes.publicResearch ?? request.researchSummary ?? "No public research notes were attached.", 4000);
  const internalFit = clip(
    notes.internalFit ??
      request.fitmentRationale?.moduleOverlap ??
      "No internal-fit notes were attached.",
    4000,
  );
  const integrationRisk = clip(notes.integrationRisk ?? risks, 4000);
  const markdown = [
    `# Solution Architecture Brief: ${request.vendorName ?? request.id}`,
    "",
    `- Request: ${request.id}`,
    `- Requester: ${request.requesterName ?? "unknown"}`,
    `- Service category: ${request.serviceCategory ?? "unknown"}`,
    `- Urgency: ${request.urgency ?? "unknown"}`,
    `- Security compliance: ${request.securityCompliance ?? "unknown"}`,
    `- FIX support: ${fixSupport || "unknown"}`,
    `- Fitment score: ${request.fitmentScore ?? "not scored"}`,
    "",
    "## Public research",
    "",
    publicResearch,
    "",
    "## Internal fit",
    "",
    internalFit,
    "",
    "## Integration risk",
    "",
    integrationRisk,
    "",
    risks,
    "",
    "## Guidelines cited",
    "",
    ...GUIDELINES.map((guideline) => `- **${guideline.title}** (${guideline.id}): ${guideline.body}`),
    "",
    "## PlantUML",
    "",
    "```plantuml",
    plantUml,
    "```",
    "",
  ].join("\n");
  return { markdown, plantUml };
}

export function compileRfp(request: VendorRequest): string {
  const specs = request.integrationSpecs;
  return [
    `# Request for Proposal: ${request.vendorName ?? request.id}`,
    "",
    "Acme is soliciting a proposal for the vendor below. This document exists only because the request status is approved.",
    "",
    "## Parties",
    "",
    `- Requester: ${request.requesterName ?? "unknown"}`,
    `- Vendor: ${request.vendorName ?? "unknown"}`,
    `- Service category: ${request.serviceCategory ?? "unknown"}`,
    `- Urgency: ${request.urgency ?? "unknown"}`,
    "",
    "## Security",
    "",
    request.securityCompliance ?? "Security compliance was not recorded.",
    "",
    "## Integration",
    "",
    `- Modules: ${(specs?.modules ?? []).join(", ") || "none"}`,
    `- FIX support: ${specs?.fixSupport || "unspecified"}`,
    `- Notes: ${specs?.notes || "none"}`,
    "",
    "## Fitment",
    "",
    `Score: ${request.fitmentScore ?? "n/a"} / 100.`,
    "",
    request.fitmentRationale?.publicValue ?? "",
    "",
    request.fitmentRationale?.reputation ?? "",
    "",
    request.fitmentRationale?.fixCompatibility ?? "",
    "",
    request.fitmentRationale?.moduleOverlap ?? "",
    "",
    "## Architecture constraints",
    "",
    ...GUIDELINES.map((guideline) => `- ${guideline.title}: ${guideline.body}`),
    "",
    "## Response requested",
    "",
    "Describe how the service integrates beside Acme's trade matching, market surveillance, and clearing modules. Include FIX session details, security evidence, and a cost range. Do not propose replacing a core module unless the architecture brief already recorded that risk.",
    "",
  ].join("\n");
}

function costSignal(request: VendorRequest): string {
  const summary = request.researchSummary ?? "";
  const mentioned = /\$|pricing|cost|license|subscription/i.test(summary);
  const price = mentioned
    ? "Research notes mention cost language. This summary does not quote a price because intake did not verify one."
    : "No cost figure was captured at intake.";
  return `${price} Urgency is ${request.urgency ?? "unspecified"}, which is a scheduling signal for exchange capacity rather than a price.`;
}

export function leadershipSummary(requests: readonly VendorRequest[], nowIso: string): {
  summary: string;
  approvedCount: number;
  requestIds: string[];
} {
  const approved = requests.filter((request) => request.status === "approved");
  const header = `# Business Value Proposition\n\nGenerated ${nowIso}.`;
  const goals =
    "Strategic fit is judged against Acme's clearing and exchange goals: keep trade matching deterministic and off the vendor's process, attach surveillance at drop copy, and clear through Acme so positions stay reconcilable.";
  if (approved.length === 0) {
    return {
      summary: [
        header,
        "",
        "No vendor requests are approved. There is no executive decision to post this week.",
        "",
        goals,
        "",
        "Cost signals: none. Competitive notes: none.",
        "",
      ].join("\n"),
      approvedCount: 0,
      requestIds: [],
    };
  }
  const sections = approved.map((request) => {
    const competitive = clip(request.researchSummary ?? "No competitive notes were stored.", 800);
    return [
      `## ${request.vendorName ?? request.id}`,
      "",
      `- Category: ${request.serviceCategory ?? "unspecified"}`,
      `- Fitment: ${request.fitmentScore ?? "n/a"} / 100`,
      `- Modules: ${(request.integrationSpecs?.modules ?? []).join(", ") || "none"}`,
      "",
      `Strategic fit: ${request.fitmentRationale?.moduleOverlap ?? "Fitment rationale was not stored."}`,
      "",
      `Cost signals: ${costSignal(request)}`,
      "",
      `Competitive notes: ${competitive}`,
      "",
    ].join("\n");
  });
  return {
    summary: [header, "", goals, "", ...sections].join("\n"),
    approvedCount: approved.length,
    requestIds: approved.map((request) => request.id),
  };
}
