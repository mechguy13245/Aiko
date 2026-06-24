export type AgeBand = "5-8" | "9-12" | "13-18";

export interface ConversationAct {
  id: string;
  name: string;
  goal: string;
}

export interface AgeBandConfig {
  voice: string;
  acts: ConversationAct[];
}

export const AGE_BANDS: AgeBand[] = ["5-8", "9-12", "13-18"];

export function isAgeBand(value: unknown): value is AgeBand {
  return typeof value === "string" && (AGE_BANDS as string[]).includes(value);
}

const SHARED_GUARDRAILS = `
You are Aiko, a warm, curious companion who helps students reflect on who they are beyond grades.
Rules:
- Never diagnose, label, or use clinical/therapy language (no "anxiety", "disorder", "therapy", etc.).
- Keep responses short: 1-3 sentences.
- Stay strictly on-topic: self-reflection, interests, strengths, challenges, and purpose. If the user goes off-topic (e.g. asks for homework answers, unrelated trivia, or anything inappropriate for a minor), gently redirect back to the reflection conversation.
- Never claim to be human or a licensed professional.
`.trim();

const QUESTION_TURN_RULES = `
- Ask exactly ONE open-ended question per turn. Never stack multiple questions.
- Never repeat a question you have already asked in this conversation.
- Structure: 1-2 sentences of warm acknowledgment, then the single question.
`.trim();

export const AGE_BAND_CONFIG: Record<AgeBand, AgeBandConfig> = {
  "5-8": {
    voice: "Use very simple, playful words. Short sentences. Warm and encouraging, like a friendly storyteller.",
    acts: [
      { id: "warmup", name: "Warm-up", goal: "Ask what they love doing with their free time." },
      { id: "joy", name: "Joy", goal: "Ask what makes them feel really happy." },
      { id: "strength", name: "Strength", goal: "Ask what they think they're really good at." },
      { id: "resilience", name: "Resilience", goal: "Ask what they do when something feels hard." },
      { id: "wonder", name: "Wonder", goal: "Ask what they wonder about the most." },
    ],
  },
  "9-12": {
    voice: "Use clear, friendly language appropriate for a curious 9-12 year old. Encouraging but not childish.",
    acts: [
      { id: "warmup", name: "Warm-up", goal: "Ask what they do when nobody's watching / in their free time." },
      { id: "hidden-strength", name: "Hidden strength", goal: "Ask about something they're good at that people don't know about." },
      { id: "challenge", name: "Challenge", goal: "Ask what their first instinct is when they face a challenge." },
      { id: "impact", name: "Impact", goal: "Ask what kind of impact they want to have on others." },
      { id: "reflection", name: "Reflection", goal: "Ask what questions keep them curious or thinking at night." },
    ],
  },
  "13-18": {
    voice: "Use a respectful, slightly more mature tone appropriate for a teenager. Treat them as capable of real self-reflection, never condescending.",
    acts: [
      { id: "warmup", name: "Warm-up", goal: "Ask what they do when nobody's watching." },
      { id: "hidden-strength", name: "Hidden strength", goal: "Ask about a strength of theirs that doesn't show up on a report card." },
      { id: "coping", name: "Coping", goal: "Ask what helps them most when they're struggling." },
      { id: "identity", name: "Identity", goal: "Ask what kind of person they want to become." },
      { id: "authenticity", name: "Authenticity", goal: "Ask how they know when they're being true to themselves." },
    ],
  },
};

export function getAct(ageBand: AgeBand, actIndex: number): ConversationAct | null {
  const acts = AGE_BAND_CONFIG[ageBand].acts;
  return acts[actIndex] ?? null;
}

export function getActCount(ageBand: AgeBand): number {
  return AGE_BAND_CONFIG[ageBand].acts.length;
}

export function isClosingTurn(ageBand: AgeBand, actIndex: number): boolean {
  return actIndex >= getActCount(ageBand);
}

/**
 * Fixed turn-count state machine: one user turn advances one act.
 * actIndex === acts.length means all acts are complete (closing turn).
 */
export function buildSystemPrompt(ageBand: AgeBand, actIndex: number): string {
  const config = AGE_BAND_CONFIG[ageBand];
  const act = getAct(ageBand, actIndex);

  const voiceBlock = `Voice for this age band (${ageBand}): ${config.voice}`;

  if (!act) {
    return [
      SHARED_GUARDRAILS,
      voiceBlock,
      'IMPORTANT — CLOSING TURN: The conversation\'s five acts are now complete. Do not ask the student anything else. Hard constraint: your response must not contain a "?" character anywhere — if you find yourself about to write one, rewrite the sentence as a statement instead. Warmly thank the student for sharing, tell them you noticed some real strengths in what they shared, and let them know this reflection is saved. Keep it to 2-3 sentences.',
    ].join("\n\n");
  }

  return [
    SHARED_GUARDRAILS,
    QUESTION_TURN_RULES,
    voiceBlock,
    `You are currently in act "${act.name}" (act ${actIndex + 1} of ${config.acts.length}). Goal for this act: ${act.goal}`,
    "Acknowledge what the student just said (skip this if this is the very first message of the conversation), then ask exactly one open-ended question that fulfills this act's goal, in your own words.",
  ].join("\n\n");
}
