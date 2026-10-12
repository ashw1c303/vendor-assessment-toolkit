/**
 * Acme architecture guidelines. Fitment and briefs cite this module so a
 * live vector database is not required.
 */

export type Guideline = {
  id: string;
  title: string;
  body: string;
};

export const GUIDELINES: readonly Guideline[] = [
  {
    id: "trade-matching",
    title: "Trade matching",
    body: "Acme runs a high-throughput, deterministic matching engine with price-time priority. A vendor must not sit in the critical matching path. Preferred integration is a pre-trade or post-trade adapter, not an in-process replacement.",
  },
  {
    id: "market-surveillance",
    title: "Market surveillance",
    body: "Surveillance consumes normalized drop copy and emits alerts. It must not add latency to matching. Vendors attach at the drop-copy boundary.",
  },
  {
    id: "clearing",
    title: "Clearing",
    body: "Clearing covers novation, margin, settlement instructions, and end-of-day positions. Vendors integrate through clearing APIs and must not hold unreconciled positions.",
  },
  {
    id: "fix-compatibility",
    title: "FIX compatibility",
    body: "Order entry and drop copy use FIX 4.2 and FIX 4.4. Any component that emits or consumes orders or executions needs native FIX or a certified adapter. Non-FIX market data is allowed only behind an Acme adapter.",
  },
  {
    id: "capability-overlap",
    title: "Overlap with existing capabilities",
    body: "Acme already operates trade matching, market surveillance, and clearing. A vendor that duplicates one of these is a fit only when it fills a stated gap and can run beside the existing module. Replacing a core module is out of pattern unless the architecture brief records that risk.",
  },
];

export type AcmeModule = {
  id: string;
  title: string;
  aliases: readonly string[];
  touched: string;
  untouched: string;
};

export const ACME_MODULES: readonly AcmeModule[] = [
  {
    id: "trade-matching",
    title: "Trade Matching",
    aliases: ["trade-matching", "trade matching", "matching", "order matching", "match engine"],
    touched:
      "The vendor touches trade matching. Keep it off the critical path and integrate with a pre-trade or post-trade adapter.",
    untouched:
      "The vendor does not touch trade matching. The matching engine stays inside Acme.",
  },
  {
    id: "market-surveillance",
    title: "Market Surveillance",
    aliases: ["market-surveillance", "market surveillance", "surveillance", "drop copy", "drop-copy"],
    touched:
      "The vendor touches market surveillance. Attach at normalized drop copy so matching latency is unchanged.",
    untouched:
      "The vendor does not touch market surveillance. Existing drop-copy alerts stay in place.",
  },
  {
    id: "clearing",
    title: "Clearing",
    aliases: ["clearing", "ccp", "settlement", "novation"],
    touched:
      "The vendor touches clearing. Use clearing APIs for novation, margin, and settlement, and do not leave unreconciled positions with the vendor.",
    untouched: "The vendor does not touch clearing. Novation and settlement stay on Acme's clearing service.",
  },
];

const MODULE_IDS = new Set(ACME_MODULES.map((module) => module.id));

export function matchModule(raw: string): string | undefined {
  const text = raw.trim().toLowerCase();
  if (text === "") return undefined;
  if (MODULE_IDS.has(text)) return text;
  for (const module of ACME_MODULES) {
    if (module.aliases.some((alias) => text === alias || text.includes(alias))) {
      return module.id;
    }
  }
  return undefined;
}

export function normalizeModuleList(inputs: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of inputs) {
    const trimmed = raw.trim().replace(/\s+/g, " ");
    if (trimmed === "") continue;
    const id = matchModule(trimmed);
    const value = id ?? `other:${trimmed}`;
    if (!out.includes(value)) out.push(value);
  }
  return out;
}

export function recognizedModules(modules: readonly string[]): string[] {
  return modules.filter((module) => MODULE_IDS.has(module));
}

/** Blank input stays blank so the field still counts as missing. */
export function normalizeFixSupport(value: boolean | string | null | undefined): string {
  if (typeof value === "boolean") return value ? "full" : "none";
  if (typeof value !== "string") return "";
  const text = value.trim().toLowerCase();
  if (text === "") return "";
  if (/^(none|no|false|unsupported)$/.test(text) || /\bno\b|\bnot\b|\bwithout\b/.test(text)) {
    return "none";
  }
  if (/partial|planned|limited/.test(text)) return "partial";
  if (/^(full|native|yes|true|supported)$/.test(text) || /fix/.test(text)) return "full";
  return "unknown";
}

export function fixScore(fixSupport: string): number {
  if (fixSupport === "full") return 25;
  if (fixSupport === "partial") return 12;
  if (fixSupport === "none") return 0;
  return 5;
}

export function overlapScore(modules: readonly string[]): number {
  const count = recognizedModules(modules).length;
  if (count >= 3) return 25;
  if (count === 2) return 21;
  if (count === 1) return 16;
  return 6;
}

export function clampQuarter(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(25, Math.round(value)));
}

function plantLabel(value: string): string {
  const cleaned = value.replace(/[\r\n"]/g, " ").trim();
  return cleaned === "" ? "Vendor" : cleaned;
}

export function generatePlantUml(input: {
  vendorName: string;
  serviceCategory: string;
  modules: readonly string[];
  fixSupport: string;
}): string {
  const vendor = plantLabel(input.vendorName);
  const category = plantLabel(input.serviceCategory);
  const recognized = new Set(recognizedModules(input.modules));
  const fix =
    input.fixSupport === "full"
      ? "FIX 4.2/4.4"
      : input.fixSupport === "partial"
        ? "partial FIX"
        : input.fixSupport === "none"
          ? "adapter required"
          : "FIX unspecified";
  const arrows: string[] = [];
  if (recognized.has("trade-matching")) {
    arrows.push(`Vendor --> Matching : ${fix} order entry`);
  }
  if (recognized.has("market-surveillance")) {
    arrows.push("Vendor --> Surveillance : drop copy / alerts");
  }
  if (recognized.has("clearing")) {
    arrows.push("Vendor --> Clearing : settlement and margin");
  }
  const others = input.modules.filter((module) => module.startsWith("other:"));
  const note =
    others.length > 0
      ? `note bottom of Vendor\n  Unmapped: ${others.map((module) => module.slice("other:".length)).join(", ")}\nend note`
      : "";
  return [
    "@startuml acme-vendor-integration",
    "skinparam componentStyle rectangle",
    `title ${vendor} integration`,
    "package \"Acme B2B Exchange\" {",
    "  component \"Trade Matching\" as Matching",
    "  component \"Market Surveillance\" as Surveillance",
    "  component \"Clearing\" as Clearing",
    "}",
    `component "${vendor}\\n${category}" as Vendor`,
    "Matching --> Surveillance : normalized drop copy",
    "Matching --> Clearing : executions for novation",
    ...arrows,
    note,
    "@enduml",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function guidelineById(id: string): Guideline | undefined {
  return GUIDELINES.find((guideline) => guideline.id === id);
}
