/**
 * Phase 1 reproduction test — Death Note exchange.
 *
 * Run with: npx tsx scripts/test-phase1.ts
 *
 * Tests:
 *   1. What judgeReply returns for the thin "kira, he is a good guy" reply
 *   2. What judgeReply returns for the richer "Aligned with his mission..." reply
 *   3. Whether the deepen path fires correctly after one satisfied reply
 *   4. What system prompt the deepen path generates (before/after fix)
 *   5. Additional cases: rich-then-advance, rich-tangent, original failure
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local from the project root (handles Windows \r\n and quoted values)
try {
  const envFile = readFileSync(resolve(__dirname, "../.env.local"), "utf-8");
  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) process.env[key] = val;
  }
} catch {}

import { judgeReply } from "../lib/aiko/judge";
import { buildSystemPrompt, getAct, minRepliesFor, type ActState, MIN_SATISFACTORY_REPLIES_PER_ACT } from "../lib/aiko/conversation";

const AGE_BAND = "13-18" as const;
const REAL_SELF_ACT_INDEX = 1; // index of 'real-self' in 13-18 acts

const realSelfAct = getAct(AGE_BAND, REAL_SELF_ACT_INDEX)!;

function printSeparator(label: string) {
  console.log("\n" + "=".repeat(60));
  console.log("  " + label);
  console.log("=".repeat(60));
}

// --- Case A: Original failure (Death Note exchange) ---
// Prior: Aiko asked what draws them to Death Note, student replied thinly,
// Aiko asked why, student gave the richer reply.
const deathNoteContext = [
  {
    role: "assistant" as const,
    content:
      "When you have completely free time and zero pressure, what do you actually end up doing — not what you think you should do?",
  },
  { role: "user" as const, content: "watch anime like death note" },
  {
    role: "assistant" as const,
    content: "Death Note — okay. What is it about Death Note specifically that draws you in?",
  },
  { role: "user" as const, content: "kira, he is a good guy" },
  {
    role: "assistant" as const,
    content: "Hm, Kira as \"the good guy\" is a take. What makes him feel like the good guy to you?",
  },
];

// --- Case B: rich answer that should deepen once then advance ---
const richSimpleContext = [
  {
    role: "assistant" as const,
    content:
      "When you have completely free time and zero pressure, what do you actually end up doing?",
  },
  { role: "user" as const, content: "I spend hours modding video games, adding custom levels and characters" },
  {
    role: "assistant" as const,
    content: "Custom levels and characters — what's the most ambitious mod you've made?",
  },
];

// --- Case C: rich tangent answer where Aiko should follow one more turn ---
const richTangentContext = [
  {
    role: "assistant" as const,
    content: "When you have completely free time and zero pressure, what do you actually end up doing?",
  },
  { role: "user" as const, content: "I write these little stories in my notes app that no one ever reads" },
  {
    role: "assistant" as const,
    content: "Notes app stories nobody reads — what kind of stories?",
  },
];

async function runCase(
  label: string,
  context: { role: "user" | "assistant"; content: string }[],
  reply: string,
  currentSatisfiedCount: number,
) {
  printSeparator(label);
  console.log(`\nStudent reply: "${reply}"`);
  console.log(`Current satisfiedCount: ${currentSatisfiedCount}`);
  console.log(`minReplies for this act: ${minRepliesFor(realSelfAct)}`);

  const judgment = await judgeReply(AGE_BAND, realSelfAct, context, reply);
  console.log("\nJudge result:", JSON.stringify(judgment, null, 2));

  // Simulate route handler logic
  const MIN = minRepliesFor(realSelfAct);
  let deepen = false;
  let advances = false;
  let nudgeSituation: string | null = null;

  if (judgment.satisfied) {
    const newSatisfiedCount = currentSatisfiedCount + 1;
    if (newSatisfiedCount >= MIN) {
      advances = true;
      console.log(`\n→ ADVANCES to next act (satisfiedCount ${newSatisfiedCount} >= minReplies ${MIN})`);
    } else {
      deepen = true;
      console.log(`\n→ DEEPEN fires (satisfiedCount ${newSatisfiedCount} < minReplies ${MIN})`);
    }
  } else {
    nudgeSituation = judgment.situation;
    console.log(`\n→ NUDGE fires (situation: ${judgment.situation})`);
  }

  if (deepen) {
    const state: ActState = { actIndex: REAL_SELF_ACT_INDEX, nudgeCount: 0, satisfiedCount: currentSatisfiedCount + 1 };
    const richness = judgment.richness;
    console.log(`\nRichness from judge: ${richness ?? "(not set)"}`);
    const prompt = buildSystemPrompt({ ageBand: AGE_BAND, state, deepen: { richness } });
    console.log("\n--- GENERATED SYSTEM PROMPT (deepen) excerpt ---\n");
    const deepenStart = prompt.indexOf("Their answer was") !== -1 ? prompt.indexOf("Their answer was") : prompt.indexOf("background:");
    console.log(prompt.substring(Math.max(0, deepenStart - 200)));
  }

  if (advances) {
    const state: ActState = { actIndex: REAL_SELF_ACT_INDEX + 1, nudgeCount: 0, satisfiedCount: 0 };
    const prompt = buildSystemPrompt({ ageBand: AGE_BAND, state });
    console.log("\n--- GENERATED SYSTEM PROMPT (advance to next act) ---\n");
    console.log(prompt.substring(prompt.indexOf("You are currently on")));
  }

  return { judgment, deepen, advances, nudgeSituation };
}

async function main() {
  console.log("Phase 1 — Death Note pacing reproduction test");
  console.log(`Real-self act: "${realSelfAct.name}"`);
  console.log(`Success criteria: "${realSelfAct.successCriteria}"`);
  console.log(`MIN_SATISFACTORY_REPLIES_PER_ACT: ${MIN_SATISFACTORY_REPLIES_PER_ACT}`);

  // CASE A — the original failure: thin first reply then richer second reply
  // First reply was "kira, he is a good guy" (simulated as already processed)
  // Now judge the richer second reply
  const caseA1 = await runCase(
    "Case A1 — Death Note thin reply (kira, he is a good guy)",
    deathNoteContext.slice(0, -2), // context before this reply
    "kira, he is a good guy",
    0,
  );

  // Now simulate: if kira reply was NOT satisfied, satisfiedCount is still 0
  // If it WAS satisfied, satisfiedCount is 1
  const satisfiedAfterA1 = caseA1.judgment.satisfied ? 1 : 0;

  await runCase(
    "Case A2 — Death Note richer reply (Aligned with his mission...)",
    deathNoteContext,
    "Aligned with his mission and totally dedicated towards it feels cool",
    satisfiedAfterA1,
  );

  // CASE B — rich answer, should deepen once then advance
  await runCase(
    "Case B1 — Rich answer, first satisfied reply (should DEEPEN)",
    richSimpleContext.slice(0, -2),
    "I spend hours modding video games, adding custom levels and characters",
    0,
  );

  await runCase(
    "Case B2 — Rich answer, second satisfied reply after deepening (should ADVANCE)",
    richSimpleContext,
    "The most ambitious one replaced all the enemies with historical figures and gave them voice lines I wrote myself",
    1,
  );

  // CASE C — rich tangent, should stay with tangent one more turn
  await runCase(
    "Case C — Rich tangent (notes-app stories), should deepen (follow tangent)",
    richTangentContext.slice(0, -2),
    "I write these little stories in my notes app that no one ever reads",
    0,
  );

  console.log("\n" + "=".repeat(60));
  console.log("  Phase 1 test complete");
  console.log("=".repeat(60) + "\n");
}

main().catch(console.error);
