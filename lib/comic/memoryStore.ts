export interface ComicPanel {
  narration: string;
  imageUrl: string;
  userInput: string;
}

export class MemoryStore {
  private sessionId: string;
  private panels: ComicPanel[] = [];
  private iterationCount: number = 0;
  private storyContext: string = "";

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  addPanel(panel: ComicPanel) {
    this.panels.push(panel);
    this.updateContext(panel);
  }

  getAllPanels(): ComicPanel[] {
    return this.panels;
  }

  getIterationCount(): number {
    return this.iterationCount;
  }

  incrementIteration() {
    this.iterationCount++;
  }

  getStoryContext(): string {
    return this.storyContext;
  }

  private updateContext(panel: ComicPanel) {
    this.storyContext += `\nPanel ${this.iterationCount + 1}: ${panel.narration}`;
  }

  reset() {
    this.panels = [];
    this.iterationCount = 0;
    this.storyContext = "";
  }

  getSessionId(): string {
    return this.sessionId;
  }
}
