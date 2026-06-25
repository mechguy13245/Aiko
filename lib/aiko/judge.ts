import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { AgeBand, ConversationAct, ReplySituation } from "@/lib/aiko/conversation";

const judgeSchema = z.object({
  satisfied: z.boolean().describe("True only if the reply gives concrete, specific information satisfying the success criteria."),
  situation: z.enum(["satisfactory", "vague", "off-topic", "confused"]),
});

export interface JudgeResult {
  satisfied: boolean;
  situation: ReplySituation;
}

/**
 * Cheap, fast judgment of whether the student's latest reply actually
 * satisfies what we need from the current act, rather than relying on a
 * word-count heuristic. Failing open (treated as satisfied) on any error so
 * a flaky judge call never blocks the conversation from progressing.
 */
export async function judgeReply(
  ageBand: AgeBand,
  act: ConversationAct,
  recentContext: { role: "user" | "assistant"; content: string }[],
  latestReply: string,
): Promise<JudgeResult> {
  try {
    const { object } = await generateObject({
      model: openai("gpt-5.4-mini"),
      schema: judgeSchema,
      system:
        `You judge a single reply from a student (age band ${ageBand}) in a reflective conversation. ` +
        `The current question's goal: ${act.goal} ` +
        `What counts as satisfying it: ${act.successCriteria} ` +
        `Be lenient: short-but-specific answers count as satisfactory. Only mark unsatisfied if the reply is truly empty of content, a flat refusal, pure filler ("idk", "nothing", "lol"), clearly off-topic, or the student is asking what you mean.`,
      prompt: [
        ...recentContext.slice(-4).map((m) => `${m.role}: ${m.content}`),
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
