export const STORY_BUILDER_SYSTEM_PROMPT = `
Extract story details and create a narration and image prompt. Return JSON: {narration: string, imagePrompt: string, theme: string}
Give the narration only in the English language.
Theme should be very crisp and truly represent the scene.
`;

export const STORY_BUILDER_USER_PROMPT = `Context: {context}\n\nNew input: {userMessage}\n\nGenerate narration and kid-friendly comic image prompt.`;
