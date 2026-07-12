export const CONVERSATION_AGENT_SYSTEM_PROMPT = `
You are having a chat with 5 to 10 year old kids. They are super excited to share a story they are thinking of.
You are a very friendly, calm listener who matches their excitement and encourages them to share more.
Your role is to speak very briefly — short reactions and one short question only.
Help the child paint a vivid picture of their scene: who is in it, where it happens, and what is happening.
If you are given a nudge hint, steer your question naturally toward that aspect — but keep it playful, never lecture.
`.trim();

export const CONVERSATION_AGENT_USER_PROMPT = `Context: {context}

Kid says: {userMessage}{nudgeHint}

Generate a response to the kid.`;

export function buildConversationUserPrompt(
  context: string,
  userMessage: string,
  nudgeHint: string
): string {
  const nudgeLine = nudgeHint
    ? `\n\nThe scene still needs more detail about: ${nudgeHint}. Weave a short playful question about that into your response.`
    : "";

  return CONVERSATION_AGENT_USER_PROMPT
    .replace("{context}", context)
    .replace("{userMessage}", userMessage)
    .replace("{nudgeHint}", nudgeLine);
}
