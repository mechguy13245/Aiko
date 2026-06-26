import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import type { AgeBand, ConversationAct, ReplySituation } from "@/lib/aiko/conversation";

// Phase 3: richness tells the deepen path whether to stay with the concrete
// external thing one more turn (rich-needs-anchoring) vs. ask the personal
// follow-up directly (rich-ready-to-deepen). Only populated when satisfied=true.
export type ReplyRichness = "thin" | "rich-needs-anchoring" | "rich-ready-to-deepen";

const judgeSchema = z.object({
  satisfied: z.boolean().describe("True only if the reply, taken in context of the full recent thread, gives enough signal to satisfy the success criteria."),
  situation: z.enum(["satisfactory", "vague", "off-topic", "confused", "wants-to-stop"]),
  richness: z
    .enum(["thin", "rich-needs-anchoring", "rich-ready-to-deepen"])
    .describe(
      "Only meaningful when satisfied=true. thin: minimal answer that technically satisfies but gives little texture. rich-needs-anchoring: the student described something specific about an external thing (a character's qualities, a game mechanic, a chess piece) but has only talked about THAT THING — they have NOT yet referenced themselves or their own feelings/patterns. rich-ready-to-deepen: the student's reply contains explicit first-person self-reference — they said something about how THEY feel, what THEY notice, or how this connects to THEIR own life. IMPORTANT: describing a quality of an external thing (e.g. 'the way she is all powerful') is NOT self-reference even if the quality seems revealing — that is rich-needs-anchoring. Only classify as rich-ready-to-deepen when the student actually used words about themselves.",
    )
    .optional(),
});

export interface JudgeResult {
  satisfied: boolean;
  situation: ReplySituation;
  richness?: ReplyRichness;
}

/**
 * Judgment of whether the student's latest reply actually satisfies what we
 * need from the current act, rather than relying on a word-count heuristic.
 * Failing open (treated as satisfied) on any error so a flaky judge call
 * never blocks the conversation from progressing.
 *
 * Uses the full model, not mini: this is the one call in the pipeline where
 * a wrong call is costly (a one-word non-answer silently advancing the
 * conversation), and it's a contextual judgment — does this reply actually
 * answer the specific question just asked — not a narrow classification
 * task. It runs far less often than the conversational turn itself, so the
 * cost delta is small relative to the accuracy gain. Conversational replies
 * and profile extraction stay on mini; those are working well there.
 */
export async function judgeReply(
  ageBand: AgeBand,
  act: ConversationAct,
  recentContext: { role: "user" | "assistant"; content: string }[],
  latestReply: string,
): Promise<JudgeResult> {
  try {
    const { object } = await generateObject({
      model: anthropic("claude-sonnet-4-6"),
      schema: judgeSchema,
      system:
        `You judge a reply from a student (age band ${ageBand}) in a reflective conversation. ` +
        `The act's underlying goal: ${act.goal} ` +
        `What counts as satisfying it: ${act.successCriteria} ` +
        `\nIMPORTANT — evaluate the FULL RECENT THREAD as accumulated evidence, not just the latest reply in isolation. ` +
        `If the student named a real interest/activity in an earlier turn (e.g. "I watch anime like Death Note") and the last few turns were Aiko following up on THAT specific thing (asking about a character, what draws them in, etc.), the accumulated thread already contains the signal for the act — the student has demonstrated what they do with their free time. In this case, even if the latest reply is a deeper answer about the specific thing (e.g. "Aligned with his mission and totally dedicated towards it feels cool") rather than restating the free-time activity, it IS satisfying. ` +
        `First check: does the reply actually respond to the specific question in the LAST assistant message? A reply that ignores the question entirely is "off-topic". But a reply that engages specifically with what Aiko just asked — even if it's about a tangent (a character, show, game) — should be evaluated on that tangent's own merits, not marked off-topic just because the tangent itself wasn't the original act question. ` +
        `Be lenient on depth, not on relevance: short-but-specific answers that DO answer the actual last question count as satisfactory. Only mark unsatisfied if the reply is truly empty of content, a flat refusal, pure filler ("idk", "nothing", "lol"), ignores what was just asked, or the student is asking for clarification. ` +
        `Use "off-topic" ONLY when the reply genuinely ignores the conversation and jumps to something unrelated. Do not use "off-topic" for a reply that answers what Aiko just asked, even if it's a follow-up about a tangent. Use "vague" for replies that technically respond but give nothing concrete. ` +
        `Use situation "wants-to-stop" (and satisfied=false) ONLY if the student explicitly signals they want to stop, are done, or seem genuinely distressed about the conversation itself.` +
        `\nFor richness: only populate this when satisfied=true. thin = technically satisfying but minimal. rich-needs-anchoring = the student described something specific about an external thing (a character, a chess piece, a mechanic, a show) but their language was about THAT THING — no explicit self-reference, even if the preference seems psychologically revealing. rich-ready-to-deepen = the student's reply explicitly references themselves: 'I feel', 'I always want', 'I notice I...', 'for me it's because I...'. HARD EXAMPLE: 'the way she is all powerful and can do anything' = rich-needs-anchoring (describes the queen, not the student). 'I like that she can go anywhere' = still rich-needs-anchoring (liking a quality is not self-reflection). 'I feel like that too, I hate being boxed in' = rich-ready-to-deepen (explicit self-reference).`,
      prompt: [
        ...recentContext.slice(-6).map((m) => `${m.role}: ${m.content}`),
        `user: ${latestReply}`,
      ].join("\n"),
      experimental_telemetry: { isEnabled: true },
      abortSignal: AbortSignal.timeout(8000),
    });
    return object;
  } catch (err) {
    console.error("Reply judgment failed, treating as satisfied:", err);
    return { satisfied: true, situation: "satisfactory" };
  }
}
