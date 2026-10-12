import { z } from "zod";

export const integrationSpecsInput = z.object({
  modules: z.array(z.string()).optional(),
  fixSupport: z.union([z.boolean(), z.string()]).optional(),
  notes: z.string().optional(),
});

export const recordVendorInput = z
  .object({
    requesterName: z.string().optional(),
    vendorName: z.string().optional(),
    serviceCategory: z.string().optional(),
    urgency: z.string().optional(),
    securityCompliance: z.string().optional(),
    integrationSpecs: integrationSpecsInput.optional(),
  })
  .refine(
    (value) =>
      [value.requesterName, value.vendorName, value.serviceCategory].some(
        (item) => typeof item === "string" && item.trim() !== "",
      ),
    { message: "Provide a requester name, vendor name, or service category." },
  );

export const updateVendorInput = recordVendorInput
  .innerType()
  .extend({
    requestId: z.string().min(1),
    followUpNote: z.string().optional(),
  })
  .refine(
    (value) =>
      value.followUpNote !== undefined ||
      value.requesterName !== undefined ||
      value.vendorName !== undefined ||
      value.serviceCategory !== undefined ||
      value.urgency !== undefined ||
      value.securityCompliance !== undefined ||
      value.integrationSpecs !== undefined,
    { message: "Provide at least one field to update." },
  );

export const researchFixtureInput = z.object({
  summary: z.string().min(1),
  publicValue: z.number(),
  reputation: z.number(),
  sources: z
    .array(
      z.object({
        title: z.string(),
        url: z.string().optional(),
        excerpt: z.string(),
      }),
    )
    .optional(),
});

export const intakeBody = z.object({
  message: z.string().optional(),
  requestId: z.string().optional(),
  requesterName: z.string().optional(),
  vendorName: z.string().optional(),
  serviceCategory: z.string().optional(),
  urgency: z.string().optional(),
  securityCompliance: z.string().optional(),
  integrationSpecs: integrationSpecsInput.optional(),
  followUpNote: z.string().optional(),
  fixture: researchFixtureInput.optional(),
});

export type RecordVendorInput = z.infer<typeof recordVendorInput>;
export type UpdateVendorInput = z.infer<typeof updateVendorInput>;
export type ResearchFixtureInput = z.infer<typeof researchFixtureInput>;
export type IntakeBody = z.infer<typeof intakeBody>;
