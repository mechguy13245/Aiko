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

  // Per-panel state — reset after each panel is committed
  private panelTurns: number = 0;
  private panelMessages: { role: "user" | "assistant"; content: string }[] = [];
  private pendingNudgeHint: string = "";

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  addPanel(panel: ComicPanel) {
    this.panels.push(panel);
    this.updateContext(panel);
    this.resetPanelState();
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

  // Per-panel turn tracking
  incrementPanelTurns() {
    this.panelTurns++;
  }

  getPanelTurns(): number {
    return this.panelTurns;
  }

  addPanelMessage(role: "user" | "assistant", content: string) {
    this.panelMessages.push({ role, content });
  }

  getPanelMessages(): { role: "user" | "assistant"; content: string }[] {
    return this.panelMessages;
  }

  setPendingNudgeHint(hint: string) {
    this.pendingNudgeHint = hint;
  }

  getPendingNudgeHint(): string {
    return this.pendingNudgeHint;
  }

  resetPanelState() {
    this.panelTurns = 0;
    this.panelMessages = [];
    this.pendingNudgeHint = "";
  }

  private updateContext(panel: ComicPanel) {
    this.storyContext += `\nPanel ${this.iterationCount + 1}: ${panel.narration}`;
  }

  reset() {
    this.panels = [];
    this.iterationCount = 0;
    this.storyContext = "";
    this.resetPanelState();
  }

  getSessionId(): string {
    return this.sessionId;
  }
}
