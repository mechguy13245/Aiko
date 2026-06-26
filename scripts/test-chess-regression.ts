/**
 * Chess regression test — premature abstraction bug (updated for new engine).
 *
 * Original bug: after "the way she is all powerful and can do anything" Aiko
 * jumped to "Do you find yourself thinking that way in other areas too, like
 * wanting to be the one with the most options and control?" — a pre-packaged
 * interpretation phrased as a confirming question.
 *
 * Under the new engine this is fixed architecturally:
 *   - No deepen/richness branching path exists anymore
 *   - CORE_INSTRUCTION says stay with the concrete thing
 *   - REACTION_PRINCIPLES principle 7 globally bans pre-packaged interpretations
 *
 * This test verifies the structural fix is in place and the classifier behaves
 * correctly (chess interest registers as interestDomain signal, not wantsToStop).
 *
 * Run: npx tsx scripts/test-chess-regression.ts
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
import { buildSystemPrompt, INITIAL_CONVERSATION_STATE } from "../lib/aiko/conversation";

function sep(label: string) {
  console.log("\n" + "=".repeat(60));
  console.log("  " + label);
  console.log("=".repeat(60));
}

const chessContext = [
  { role: "assistant" as const, content: "What do you actually like doing when you have free time?" },
  { role: "user" as const, content: "I play chess a lot" },
  { role: "assistant" as const, content: "What is your favourite piece?" },
];

async function main() {
  let passed = 0;
  let total = 0;

  // Case 1: structural check — prompt bans pre-packaged interpretations globally
  sep("Case 1 — System prompt bans pre-packaged interpretations (no API call)");
  const prompt = buildSystemPrompt({ ageBand: "9-12", state: INITIAL_CONVERSATION_STATE });
  const hasBan = prompt.includes("NEVER PRE-PACKAGE AN INTERPRETATION AS A QUESTION");
  const hasPacing = prompt.includes("PACING RULE");
  const hasNoDeepen = !prompt.includes("rich-needs-anchoring") && !prompt.includes("rich-ready-to-deepen");
  console.log(`Ban present: ${hasBan}, pacing present: ${hasPacing}, no old deepen machinery: ${hasNoDeepen}`);
  const ok1 = hasBan && hasPacing && hasNoDeepen;
  console.log(ok1 ? "PASS" : "FAIL");
  total++; if (ok1) passed++;

  // Case 2: classifier — "the way she is all powerful" → interestDomain signal, not wantsToStop
  sep("Case 2 — Chess queen description registers as interestDomain signal");
  const r2 = await classifyTurn("9-12", chessContext, "the way she is all powerful and can do anything");
  console.log("Result:", JSON.stringify(r2, null, 2));
  const ok2 = r2.dimensions.interestDomain !== "none" && !r2.wantsToStop;
  console.log(`interestDomain: ${r2.dimensions.interestDomain}, wantsToStop: ${r2.wantsToStop}`);
  console.log(ok2 ? "PASS" : "FAIL");
  total++; if (ok2) passed++;

  // Case 3: classifier — "I feel like that too, I hate being restricted" → rich interestDomain, still no stop
  sep("Case 3 — Self-referential reply registers rich interestDomain");
  const r3 = await classifyTurn(
    "9-12",
    [...chessContext, { role: "assistant" as const, content: "What is it about the queen that draws you in?" }],
    "I feel like that too, I hate being boxed in to one spot",
  );
  console.log("Result:", JSON.stringify(r3, null, 2));
  const ok3 = r3.dimensions.interestDomain !== "none" && !r3.wantsToStop;
  console.log(ok3 ? "PASS" : "FAIL");
  total++; if (ok3) passed++;

  // Case 4: classifier — "I want to stop" → wantsToStop=true
  sep("Case 4 — Explicit stop signal detected");
  const r4 = await classifyTurn("9-12", chessContext, "I don't want to do this anymore, I want to stop");
  console.log("Result:", JSON.stringify(r4, null, 2));
  const ok4 = r4.wantsToStop === true;
  console.log(ok4 ? "PASS" : "FAIL");
  total++; if (ok4) passed++;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Chess regression: ${passed}/${total} cases passed`);
  console.log("=".repeat(60) + "\n");
  if (passed < total) process.exit(1);
}

main().catch(console.error);
