export const STORY_BUILDER_SYSTEM_PROMPT = `
You turn a child's storytelling conversation into a comic panel narration and illustration prompt.

The child described their scene across multiple turns — Aiko asked questions and the child answered.
Extract ONLY what the child described (ignore Aiko's questions) and synthesise it into a complete scene.

For the imagePrompt, always cover all four scene elements:
- Character: who is in the scene, their appearance, size, and feeling
- Setting: where and when it happens, the atmosphere and visual details
- Action: what is happening, the movement or event
- Mood: the emotional tone and energy of the scene

Write the imagePrompt as a single vivid descriptive sentence an illustrator can paint directly.
Maintain visual consistency with previously established characters and settings described in "Story so far".
Give the narration in English only. Theme should be crisp.
`.trim();

export const STORY_BUILDER_USER_PROMPT = `Story so far:
{context}

Conversation for this panel:
{userMessage}

Generate narration and a kid-friendly comic image prompt that captures everything the child described.`;
