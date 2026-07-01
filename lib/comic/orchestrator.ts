import { ConversationAgent } from "./conversationAgent";
import { StoryBuilder } from "./storyBuilder";
import { ImageGenerator } from "./imageGenerator";
import { MemoryStore } from "./memoryStore";

export interface OrchestratorConfig {
  maxIterations?: number;
  sessionId: string;
}

export class ComicOrchestrator {
  private conversationAgent: ConversationAgent;
  private storyBuilder: StoryBuilder;
  private imageGenerator: ImageGenerator;
  private memoryStore: MemoryStore;
  private maxIterations: number;

  constructor(config: OrchestratorConfig) {
    this.maxIterations = config.maxIterations ?? 5;
    this.memoryStore = new MemoryStore(config.sessionId);
    this.conversationAgent = new ConversationAgent(this.memoryStore);
    this.storyBuilder = new StoryBuilder(this.memoryStore);
    this.imageGenerator = new ImageGenerator();
  }

  async handleUserMessage(audioBase64?: string): Promise<{
    response: string;
    audioBase64?: string;
    audioMimeType?: string;
    imageUrl?: string;
    theme?: string;
    isDone: boolean;
    error?: string;
  }> {
    const currentIteration = this.memoryStore.getIterationCount();

    if (currentIteration >= this.maxIterations) {
      return { response: "🎉 Your amazing comic is ready!", isDone: true };
    }

    let userText = "";
    if (audioBase64) {
      try {
        const audioBuffer = Buffer.from(audioBase64, "base64");
        userText = await this.conversationAgent.transcribeAudio(audioBuffer);
      } catch (error: any) {
        const isAudioTooShort =
          error?.message?.includes("too short") ||
          error?.message?.includes("Minimum audio length");

        if (isAudioTooShort) {
          return { response: "", isDone: false, error: "AUDIO_TOO_SHORT" };
        }

        return {
          response: "Sorry, I couldn't hear you. Can you say that again?",
          isDone: false,
        };
      }
    }

    if (!userText.trim()) {
      return { response: "", isDone: false, error: "AUDIO_TOO_SHORT" };
    }

    const [conversationResult, storyData] = await Promise.all([
      this.conversationAgent.chat(userText),
      this.storyBuilder.extractAndBuild(userText),
    ]);

    const imageUrl = await this.imageGenerator.generate(storyData.imagePrompt);

    this.memoryStore.addPanel({
      narration: storyData.narration,
      imageUrl,
      userInput: userText,
    });

    this.memoryStore.incrementIteration();

    return {
      response: conversationResult.text,
      audioBase64: conversationResult.audioBase64,
      audioMimeType: conversationResult.audioMimeType,
      imageUrl,
      theme: storyData.theme,
      isDone: false,
    };
  }

  reset() {
    this.memoryStore.reset();
  }
}
