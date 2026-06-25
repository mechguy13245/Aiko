import { z } from "zod";

// The five-dimension data contract: whatever the conversation does turn to
// turn, it should be building toward filling these with real, specific
// values — not generic placeholders like "curious learner" that could
// describe any student.
export const profileSchema = z.object({
  interestDomain: z
    .string()
    .describe(
      "The subject-agnostic area that consistently draws their attention — a domain of curiosity, not a school subject. e.g. \"systems and how things work\".",
    ),
  naturalStrength: z
    .string()
    .describe(
      "A skill that feels easy to the student but is genuinely uncommon — usually invisible to the student themselves. e.g. \"holds complexity without getting overwhelmed\".",
    ),
  realSelfSignal: z
    .string()
    .describe(
      "What they do/think when there's no audience or grade attached, contrasted with what they perform for adults. e.g. \"researches obsessively alone, but downplays it socially\".",
    ),
  purposeDirection: z
    .string()
    .describe(
      "What they're oriented toward building or becoming — a direction, not a fixed career answer. e.g. \"wants to build things that solve real problems\".",
    ),
  paceStyle: z
    .string()
    .describe(
      "How they seem to process — fast/exploratory vs. slow/deep, verbal vs. visual vs. kinesthetic cues. e.g. \"slow starter, then deep and sustained focus\".",
    ),
  confidence: z.object({
    interestDomain: z.number().min(0).max(1),
    naturalStrength: z.number().min(0).max(1),
    realSelfSignal: z.number().min(0).max(1),
    purposeDirection: z.number().min(0).max(1),
    paceStyle: z.number().min(0).max(1),
  }),
  summary: z
    .string()
    .describe("A warm 1-2 sentence summary of what was observed, suitable for showing directly to the student."),
});

export type Profile = z.infer<typeof profileSchema>;
