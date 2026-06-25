export interface ModerationResult {
  flagged: boolean;
  selfHarm: boolean;
}

export async function checkModeration(text: string): Promise<ModerationResult> {
  if (!text.trim()) return { flagged: false, selfHarm: false };
  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { flagged: false, selfHarm: false };
    const data = await res.json();
    const result = data?.results?.[0];
    if (!result) return { flagged: false, selfHarm: false };
    const categories = result.categories ?? {};
    const selfHarm = Boolean(categories["self-harm"] || categories["self-harm/intent"] || categories["self-harm/instructions"]);
    return { flagged: Boolean(result.flagged), selfHarm };
  } catch (err) {
    console.error("Moderation check failed, allowing message through:", err);
    return { flagged: false, selfHarm: false };
  }
}

// Generic off-topic/inappropriate content: steer back to the reflection space.
// Firm, no question — asking something right after redirecting signals softness.
export const CALM_REDIRECT_MESSAGE =
  "This space is just for exploring who you are — your interests, strengths, and what makes you you. Let's keep it there.";

// Second violation in a session: noticeably firmer, still no question.
export const CALM_REDIRECT_ESCALATED_MESSAGE =
  "I've already asked us to keep this focused. I'm here to talk about you — your strengths, interests, and what you're about. That's it.";

// Third or more: close the session. No question, no invitation to continue.
export const SESSION_PAUSED_MESSAGE =
  "I'm going to close our chat here. Come back when you'd like to explore who you actually are.";

// Self-harm signal: this is a real escalation case, not something to redirect
// past. Point toward a trusted adult / real support rather than continuing
// the script. TODO(product/legal): confirm the right escalation path before
// wider rollout (e.g. surfacing a crisis line, notifying a guardian/counselor).
export const SELF_HARM_RESPONSE =
  "I want to pause here. What you just shared sounds really heavy, and I'm not the right one to help you carry it. Please talk to a parent, teacher, school counselor, or another adult you trust about this as soon as you can — you deserve real support, not just a chat with me.";

export const FALLBACK_ACT_MESSAGE = "Sorry, I glitched for a second there. Can you say that again?";

export const FALLBACK_CLOSING_MESSAGE =
  "Thanks so much for sharing today. I noticed real strengths in what you told me, and this reflection is saved. Come back anytime.";
