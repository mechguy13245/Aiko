/**
 * Phase 4 regression tests for the new child-led conversation engine.
 *
 * Tests:
 *   1. classifyTurn — chess exchange → interestDomain gets signal (not "none")
 *   2. classifyTurn — Death Note exchange → interestDomain gets signal
 *   3. buildSystemPrompt — backstop block absent before turn 10
 *   4. buildSystemPrompt — backstop block present after turn 10, phrased as advisory
 *   5. buildSystemPrompt — closing turn has no question mark in the instruction
 *   6. buildSystemPrompt — breathe turn has no question mark in the instruction
 *   7. buildSystemPrompt — CORE_INSTRUCTION present on normal turns
 *   8. buildSystemPrompt — REACTION_PRINCIPLES principle 7 bans pre-packaged interpretations
 *
 * Run: npx tsx scripts/test-regression.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

try {
  const envFile = readFileSync(resolve(__dirname, "../.env.local"), "utf-8");
  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (key) process.env[key] = val;
  }
} catch {}

import { classifyTurn } from "../lib/aiko/judge";
import { buildSystemPrompt, INITIAL_CONVERSATION_STATE, DIMENSION_KEYS, type ConversationState } from "../lib/aiko/conversation";

function sep(label: string) {
  console.log("\n" + "=".repeat(60));
  console.log("  " + label);
  console.log("=".repeat(60));
}

function makeState(overrides: Partial<ConversationState> = {}): ConversationState {
  return {
    ...INITIAL_CONVERSATION_STATE,
    dimensions: {
      interestDomain:   { richness: "none", lastTurnIndex: null },
      naturalStrength:  { richness: "none", lastTurnIndex: null },
      realSelfSignal:   { richness: "none", lastTurnIndex: null },
      purposeDirection: { richness: "none", lastTurnIndex: null },
      paceStyle:        { richness: "none", lastTurnIndex: null },
    },
    ...overrides,
  };
}

// ── Prompt-only tests (no API calls) ─────────────────────────────────────────

function testPromptStructure(): number {
  let passed = 0;
  let total = 0;

  // Test 3: no backstop before turn 10
  sep("Test 3 — No backstop block before turn 10");
  const earlyState = makeState({ turnCount: 5 });
  const earlyPrompt = buildSystemPrompt({ ageBand: "9-12", state: earlyState });
  const hasEarlyBackstop = earlyPrompt.includes("SOFT BACKSTOP");
  console.log(`Backstop present: ${hasEarlyBackstop} — expected: false`);
  const t3 = !hasEarlyBackstop;
  console.log(t3 ? "PASS" : "FAIL");
  total++; if (t3) passed++;

  // Test 4: backstop present after turn 10, phrased as advisory
  sep("Test 4 — Backstop block present and advisory after turn 10");
  const lateState = makeState({
    turnCount: 12,
    dimensions: {
      interestDomain:   { richness: "rich", lastTurnIndex: 3 },
      naturalStrength:  { richness: "none", lastTurnIndex: null },
      realSelfSignal:   { richness: "thin", lastTurnIndex: 7 },
      purposeDirection: { richness: "none", lastTurnIndex: null },
      paceStyle:        { richness: "none", lastTurnIndex: null },
    },
  });
  const latePrompt = buildSystemPrompt({ ageBand: "9-12", state: lateState });
  const hasBackstop = latePrompt.includes("SOFT BACKSTOP");
  const isAdvisory = latePrompt.includes("you may gently");
  const notDirective = !latePrompt.includes("you must") && !latePrompt.includes("you need to");
  const showsUntouched = latePrompt.includes("natural strength") || latePrompt.includes("what comes naturally");
  console.log(`Has backstop: ${hasBackstop}, advisory: ${isAdvisory}, not directive: ${notDirective}, shows untouched: ${showsUntouched}`);
  const t4 = hasBackstop && isAdvisory && notDirective && showsUntouched;
  console.log(t4 ? "PASS" : "FAIL");
  total++; if (t4) passed++;

  // Test 5: closing turn has no question mark in instruction
  sep("Test 5 — Closing turn system prompt bans question marks");
  const closingPrompt = buildSystemPrompt({ ageBand: "13-18", state: makeState(), isClosing: true });
  const closingBansQ = closingPrompt.toLowerCase().includes("no question mark");
  console.log(`Closing prompt bans question marks: ${closingBansQ}`);
  console.log(closingBansQ ? "PASS" : "FAIL");
  total++; if (closingBansQ) passed++;

  // Test 6: breathe turn has no question mark in instruction
  sep("Test 6 — Breathe turn system prompt bans question marks");
  const breathePrompt = buildSystemPrompt({ ageBand: "9-12", state: makeState({ consecutiveLowContentTurns: 3 }), breathe: true });
  const breatheBansQ = breathePrompt.includes('no "?"') || breathePrompt.toLowerCase().includes("no question");
  console.log(`Breathe prompt bans questions: ${breatheBansQ}`);
  console.log(breatheBansQ ? "PASS" : "FAIL");
  total++; if (breatheBansQ) passed++;

  // Test 7: normal prompt contains CORE_INSTRUCTION
  sep("Test 7 — Normal turn prompt contains CORE INSTRUCTION");
  const normalPrompt = buildSystemPrompt({ ageBand: "9-12", state: makeState({ turnCount: 2 }) });
  const hasCore = normalPrompt.includes("CORE INSTRUCTION");
  const hasPacing = normalPrompt.includes("PACING RULE");
  console.log(`Has CORE INSTRUCTION: ${hasCore}, has PACING RULE: ${hasPacing}`);
  const t7 = hasCore && hasPacing;
  console.log(t7 ? "PASS" : "FAIL");
  total++; if (t7) passed++;

  // Test 8: REACTION_PRINCIPLES principle 7 present in normal prompt
  sep("Test 8 — REACTION_PRINCIPLES bans pre-packaged interpretations");
  const hasPrinciple7 = normalPrompt.includes("NEVER PRE-PACKAGE AN INTERPRETATION AS A QUESTION");
  console.log(`Principle 7 present: ${hasPrinciple7}`);
  console.log(hasPrinciple7 ? "PASS" : "FAIL");
  total++; if (hasPrinciple7) passed++;

  return passed / total;
}

// ── API-dependent tests ───────────────────────────────────────────────────────

async function testClassifier(): Promise<number> {
  let passed = 0;
  let total = 0;

  // Test 1: chess exchange — "the way she is all powerful and can do anything"
  sep("Test 1 — Chess queen description → interestDomain gets signal (not none)");
  const chessContext = [
    { role: "assistant" as const, content: "What do you actually like doing when you have free time?" },
    { role: "user" as const, content: "I play chess a lot" },
    { role: "assistant" as const, content: "What's your favourite piece?" },
  ];
  const chess = await classifyTurn("9-12", chessContext, "the way she is all powerful and can do anything");
  console.log("classifyTurn result:", JSON.stringify(chess, null, 2));
  const t1 = chess.dimensions.interestDomain !== "none" && !chess.wantsToStop;
  console.log(`interestDomain: ${chess.dimensions.interestDomain} (expected: thin or rich) — ${t1 ? "PASS" : "FAIL"}`);
  total++; if (t1) passed++;

  // Test 2: Death Note exchange — "Aligned with his mission and totally dedicated"
  sep("Test 2 — Death Note engagement → interestDomain gets signal");
  const animeContext = [
    { role: "assistant" as const, content: "What do you do when nobody's watching?" },
    { role: "user" as const, content: "I watch anime like Death Note" },
    { role: "assistant" as const, content: "What draws you to Death Note specifically?" },
    { role: "user" as const, content: "I like Light" },
    { role: "assistant" as const, content: "What is it about Light that you find compelling?" },
  ];
  const deathNote = await classifyTurn("13-18", animeContext, "Aligned with his mission and totally dedicated towards it feels cool");
  console.log("classifyTurn result:", JSON.stringify(deathNote, null, 2));
  const t2 = deathNote.dimensions.interestDomain !== "none" && !deathNote.wantsToStop;
  console.log(`interestDomain: ${deathNote.dimensions.interestDomain} (expected: thin or rich) — ${t2 ? "PASS" : "FAIL"}`);
  total++; if (t2) passed++;

  return passed / total;
}

async function main() {
  const promptScore = testPromptStructure();
  console.log(`\nPrompt structure tests: ${Math.round(promptScore * 6)}/6 passed`);

  console.log("\nRunning classifier tests (requires ANTHROPIC_API_KEY)...");
  try {
    const classifierScore = await testClassifier();
    console.log(`Classifier tests: ${Math.round(classifierScore * 2)}/2 passed`);
    const allPassed = promptScore === 1 && classifierScore === 1;
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Overall: ${allPassed ? "ALL PASS" : "SOME FAILURES"}`);
    console.log("=".repeat(60));
    if (!allPassed) process.exit(1);
  } catch (err) {
    console.error("Classifier tests failed to run:", err);
    process.exit(1);
  }
}

main().catch(console.error);
