import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import type { AgeBand, DimensionKey } from "@/lib/aiko/conversation";

// Per-turn observer: classifies what signal each exchange produced across the
// five profile dimensions, and whether the child wants to stop. Replaces the
// old satisfied/situation gating model — it observes but never gates.
// Fails open on error so a flaky call never blocks the conversation.

const dimensionRichness = z.enum(["none", "thin", "rich"]);

const classifierSchema = z.object({
  dimensions: z
    .object({
      interestDomain:   dimensionRichness,
      naturalStrength:  dimensionRichness,
      realSelfSignal:   dimensionRichness,
      purposeDirection: dimensionRichness,
      paceStyle:        dimensionRichness,
    })
    .describe(
      "What signal did the child's latest reply produce for each dimension? " +
      "none = not touched at all. " +
      "thin = touched but minimally — a brief mention, nothing concrete enough to quote specifically. " +
      "rich = real specific signal — something concrete enough to ground a profile statement.",
    ),
  wantsToStop: z
    .boolean()
    .describe(
      "True only if the child explicitly signals they want to stop, are done, or seem genuinely distressed about continuing the conversation itself. A short or disengaged reply is NOT wants-to-stop.",
    ),
});

export interface ClassifyTurnResult {
  dimensions: Record<DimensionKey, "none" | "thin" | "rich">;
  wantsToStop: boolean;
}

const FAILED_CLASSIFICATION: ClassifyTurnResult = {
  dimensions: {
    interestDomain:   "none",
    naturalStrength:  "none",
    realSelfSignal:   "none",
    purposeDirection: "none",
    paceStyle:        "none",
  },
  wantsToStop: false,
};

export async function classifyTurn(
  ageBand: AgeBand,
  recentContext: { role: "user" | "assistant"; content: string }[],
  latestReply: string,
): Promise<ClassifyTurnResult> {
  try {
    const { object } = await generateObject({
      model: anthropic("claude-sonnet-4-6"),
      schema: classifierSchema,
      system:
        `You observe a single exchange in a reflection conversation between Aiko and a student (age band ${ageBand}). ` +
        `Classify what signal the student's latest reply produced across five profile dimensions:\n` +
        `- interestDomain: what genuinely pulls their curiosity — a domain, subject, activity, or type of thing they are drawn to\n` +
        `- naturalStrength: a skill or way of operating that feels easy to them but is uncommon — often invisible to the student themselves\n` +
        `- realSelfSignal: what they do or think when there is no audience — their unperformed self, contrasted with what they show adults\n` +
        `- purposeDirection: what they are oriented toward building or becoming — a direction, not a fixed career answer\n` +
        `- paceStyle: how they seem to think and process — fast/exploratory vs slow/deep, how they engage with ideas\n\n` +
        `Classify based ONLY on the student's latest reply. The conversation history is provided as context only.\n` +
        `"rich" requires something specific enough to quote — not just a topic mention but real texture about it.\n` +
        `"thin" is a genuine mention with no texture — they named something but gave nothing concrete about it.\n` +
        `"none" means the reply did not touch that dimension at all.`,
      prompt: [
        ...recentContext.slice(-6).map((m) => `${m.role}: ${m.content}`),
        `user: ${latestReply}`,
      ].join("\n"),
      experimental_telemetry: { isEnabled: true },
      abortSignal: AbortSignal.timeout(8000),
    });
    return object;
  } catch (err) {
    console.error("Turn classification failed, continuing without signal:", err);
    return FAILED_CLASSIFICATION;
  }
}
