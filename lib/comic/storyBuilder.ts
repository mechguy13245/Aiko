import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { MemoryStore } from "./memoryStore";
import {
  STORY_BUILDER_SYSTEM_PROMPT,
  STORY_BUILDER_USER_PROMPT,
} from "./prompts/storyBuilder";

export interface StoryData {
  narration: string;
  imagePrompt: string;
  theme: string;
}

const storySchema = z.object({
  narration: z.string(),
  imagePrompt: z.string(),
  theme: z.string(),
});

export class StoryBuilder {
  private memoryStore: MemoryStore;

  constructor(memoryStore: MemoryStore) {
    this.memoryStore = memoryStore;
  }

  async extractAndBuild(userMessage: string): Promise<StoryData> {
    const context = this.memoryStore.getStoryContext();

    const prompt = STORY_BUILDER_USER_PROMPT
      .replace("{context}", context)
      .replace("{userMessage}", userMessage);

    try {
      const { object } = await generateObject({
        model: gateway("anthropic/claude-sonnet-4.6"),
        system: STORY_BUILDER_SYSTEM_PROMPT,
        prompt,
        schema: storySchema,
        temperature: 0.7,
      });

      return {
        narration: object.narration || userMessage,
        imagePrompt: this.formatImagePrompt(object.imagePrompt || userMessage),
        theme: object.theme || "",
      };
    } catch (error) {
      console.error("StoryBuilder failed:", error);
      return {
        narration: userMessage,
        imagePrompt: this.formatImagePrompt(userMessage),
        theme: "",
      };
    }
  }

  private formatImagePrompt(prompt: string): string {
    return `Children's book illustration, colorful, friendly, comic panel style: ${prompt}`;
  }
}
