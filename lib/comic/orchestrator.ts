import { ConversationAgent } from "./conversationAgent";
import { StoryBuilder } from "./storyBuilder";
import { ImageGenerator } from "./imageGenerator";
import { MemoryStore } from "./memoryStore";
import { uploadComicImage } from "./storageUploader";
import { upsertComicSession, markComicSessionComplete } from "./dbStore";

export interface OrchestratorConfig {
  maxIterations?: number;
  sessionId: string;
  userId: string;
}

export class ComicOrchestrator {
  private conversationAgent: ConversationAgent;
  private storyBuilder: StoryBuilder;
  private imageGenerator: ImageGenerator;
  private memoryStore: MemoryStore;
  private maxIterations: number;
  private sessionId: string;
  private userId: string;

  constructor(config: OrchestratorConfig) {
    this.maxIterations = config.maxIterations ?? 5;
    this.sessionId = config.sessionId;
    this.userId = config.userId;
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
      await markComicSessionComplete(this.sessionId).catch(console.error);
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

    // Generate image then upload to Supabase Storage
    const rawImageUrl = await this.imageGenerator.generate(storyData.imagePrompt);
    const panelIndex = this.memoryStore.getIterationCount();
    let imageUrl = rawImageUrl;

    if (!rawImageUrl.startsWith("https://placehold")) {
      try {
        imageUrl = await uploadComicImage(rawImageUrl, this.userId, this.sessionId, panelIndex);
      } catch (err) {
        console.error("Failed to upload image to storage, using data URL:", err);
      }
    }

    this.memoryStore.addPanel({ narration: storyData.narration, imageUrl, userInput: userText });
    this.memoryStore.incrementIteration();

    // Persist to DB after every panel
    upsertComicSession(this.sessionId, this.userId, this.memoryStore.getAllPanels()).catch(console.error);

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
