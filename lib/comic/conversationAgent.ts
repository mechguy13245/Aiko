import { generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { SarvamAIClient } from "sarvamai";
import { MemoryStore } from "./memoryStore";
import {
  CONVERSATION_AGENT_SYSTEM_PROMPT,
  CONVERSATION_AGENT_USER_PROMPT,
} from "./prompts/conversationAgent";

const sarvam = new SarvamAIClient({
  apiSubscriptionKey: process.env.SARVAM_API_KEY ?? "",
});

export class ConversationAgent {
  private memoryStore: MemoryStore;

  constructor(memoryStore: MemoryStore) {
    this.memoryStore = memoryStore;
  }

  async chat(userMessage: string): Promise<{ text: string; audioBase64: string; audioMimeType: string }> {
    const context = this.memoryStore.getStoryContext();

    const prompt = CONVERSATION_AGENT_USER_PROMPT
      .replace("{context}", context)
      .replace("{userMessage}", userMessage);

    const { text } = await generateText({
      model: gateway("anthropic/claude-sonnet-4.6"),
      system: CONVERSATION_AGENT_SYSTEM_PROMPT,
      prompt,
      temperature: 0.9,
    });

    try {
      const ttsResponse = await sarvam.textToSpeech.convert({
        text: text.slice(0, 2500),
        target_language_code: "en-IN",
        model: "bulbul:v3",
        speaker: "shubh",
      });

      const audios = (ttsResponse as { audios?: string[] }).audios;
      const audioBase64 = audios?.[0] ?? "";
      return { text, audioBase64, audioMimeType: "audio/wav" };
    } catch (error) {
      console.error("TTS generation failed:", error);
      return { text, audioBase64: "", audioMimeType: "audio/wav" };
    }
  }

  async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    const ab = audioBuffer.buffer.slice(audioBuffer.byteOffset, audioBuffer.byteOffset + audioBuffer.byteLength) as ArrayBuffer;
    const blob = new Blob([ab], { type: "audio/webm" });
    const file = new File([blob], "audio.webm", { type: "audio/webm" });

    const result = await sarvam.speechToText.transcribe({
      file,
      model: "saaras:v3",
      mode: "transcribe",
    });

    return (result as { transcript?: string }).transcript ?? "";
  }
}
