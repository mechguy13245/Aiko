import { generateImage } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { IMAGE_PROMPT } from "./prompts/imagePrompt";

export class ImageGenerator {
  async generate(prompt: string): Promise<string> {
    try {
      const fullPrompt = IMAGE_PROMPT.trim() + "\n\n" + prompt;

      const result = await generateImage({
        model: gateway.image("openai/gpt-image-1-mini"),
        prompt: fullPrompt,
        size: "1024x1024",
      });

      const image = result.images[0];
      if (!image) throw new Error("No image generated");

      return `data:image/png;base64,${image.base64}`;
    } catch (error) {
      console.error("Image generation failed:", error);
      return "https://placehold.co/800x600/FFD93D/2D3436?text=Comic+Panel";
    }
  }
}
