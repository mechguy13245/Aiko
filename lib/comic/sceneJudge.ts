import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { SCENE_JUDGE_SYSTEM_PROMPT, SCENE_JUDGE_USER_PROMPT } from "./prompts/sceneJudge";

const RichnessSchema = z.enum(["none", "thin", "rich"]);

const SceneJudgeSchema = z.object({
  character: RichnessSchema,
  setting: RichnessSchema,
  action: RichnessSchema,
  isReady: z.boolean(),
  nudgeHint: z.string(),
});

export type SceneJudgeResult = z.infer<typeof SceneJudgeSchema>;

const FAIL_OPEN: SceneJudgeResult = {
  character: "none",
  setting: "none",
  action: "none",
  isReady: false,
  nudgeHint: "",
};

export async function classifyScene(
  panelMessages: { role: "user" | "assistant"; content: string }[]
): Promise<SceneJudgeResult> {
  try {
    const messagesText = panelMessages
      .map((m) => `${m.role === "user" ? "Child" : "Aiko"}: ${m.content}`)
      .join("\n");

    const prompt = SCENE_JUDGE_USER_PROMPT.replace("{messages}", messagesText);

    const { object } = await generateObject({
      model: gateway("anthropic/claude-sonnet-4.6"),
      system: SCENE_JUDGE_SYSTEM_PROMPT,
      prompt,
      schema: SceneJudgeSchema,
    });

    return object;
  } catch {
    return FAIL_OPEN;
  }
}
