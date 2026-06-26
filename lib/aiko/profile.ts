import { z } from "zod";

// The five-dimension data contract: whatever the conversation does turn to
// turn, it should be building toward filling these with real, specific
// values — not generic placeholders like "curious learner" that could
// describe any student.
//
// Each dimension is nullable: null means the conversation didn't produce
// enough signal for that dimension — not "confidence 0", but genuinely
// unknown. Profile consumers must handle null gracefully.
export const profileSchema = z.object({
  interestDomain: z
    .string()
    .nullable()
    .describe(
      "The subject-agnostic area that consistently draws their attention — a domain of curiosity, not a school subject. e.g. \"systems and how things work\". Return null if this wasn't genuinely touched in the conversation.",
    ),
  naturalStrength: z
    .string()
    .nullable()
    .describe(
      "A skill that feels easy to the student but is genuinely uncommon — usually invisible to the student themselves. e.g. \"holds complexity without getting overwhelmed\". Return null if not touched.",
    ),
  realSelfSignal: z
    .string()
    .nullable()
    .describe(
      "What they do/think when there's no audience or grade attached, contrasted with what they perform for adults. e.g. \"researches obsessively alone, but downplays it socially\". Return null if not touched.",
    ),
  purposeDirection: z
    .string()
    .nullable()
    .describe(
      "What they're oriented toward building or becoming — a direction, not a fixed career answer. e.g. \"wants to build things that solve real problems\". Return null if not touched.",
    ),
  paceStyle: z
    .string()
    .nullable()
    .describe(
      "How they seem to process — fast/exploratory vs. slow/deep, verbal vs. visual vs. kinesthetic cues. e.g. \"slow starter, then deep and sustained focus\". Return null if not touched.",
    ),
  confidence: z.object({
    interestDomain: z.number().min(0).max(1).nullable().describe("null when interestDomain is null"),
    naturalStrength: z.number().min(0).max(1).nullable().describe("null when naturalStrength is null"),
    realSelfSignal: z.number().min(0).max(1).nullable().describe("null when realSelfSignal is null"),
    purposeDirection: z.number().min(0).max(1).nullable().describe("null when purposeDirection is null"),
    paceStyle: z.number().min(0).max(1).nullable().describe("null when paceStyle is null"),
  }),
  summary: z
    .string()
    .describe("A warm 1-2 sentence summary of what was observed, suitable for showing directly to the student."),
});

export type Profile = z.infer<typeof profileSchema>;
