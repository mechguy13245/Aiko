import { z } from "zod";

export const profileSchema = z.object({
  interestDomain: z
    .string()
    .describe("The primary domain of interest shown, e.g. creative, analytical, social, physical, caregiving."),
  naturalStrength: z
    .string()
    .describe("The core natural strength observed in the conversation, in plain language."),
  purposeDirection: z
    .string()
    .describe("The kind of impact or purpose the student expressed wanting to have."),
  confidence: z.object({
    interestDomain: z.number().min(0).max(1),
    naturalStrength: z.number().min(0).max(1),
    purposeDirection: z.number().min(0).max(1),
  }),
  summary: z
    .string()
    .describe("A warm 1-2 sentence summary of what was observed, suitable for showing directly to the student."),
});

export type Profile = z.infer<typeof profileSchema>;
