/**
 * Phase 6 tests — Mirror act success bar.
 * Run with: npx tsx scripts/test-phase6.ts
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

import { judgeReply } from "../lib/aiko/judge";
import { buildSystemPrompt, getAct, minRepliesFor, type ActState } from "../lib/aiko/conversation";

const AGE_BAND = "13-18" as const;
const MIRROR_ACT_INDEX = 4; // mirror is always last (index 4) in 13-18

const mirrorAct = getAct(AGE_BAND, MIRROR_ACT_INDEX)!;

function sep(label: string) {
  console.log("\n" + "=".repeat(60));
  console.log("  " + label);
  console.log("=".repeat(60));
}

const mirrorContext = [
  {
    role: "assistant" as const,
    content:
      "Something I noticed across everything you shared: you keep pulling toward things you can shape yourself — modding games, writing stories nobody reads, building stuff. It's less about impressing anyone and more about having control over what you make. Does that feel true?",
  },
];

async function runMirrorCase(label: string, reply: string, expectedOutcome: "nudge" | "advance") {
  sep(label);
  console.log(`\nStudent reply: "${reply}"`);
  console.log(`Mirror successCriteria: "${mirrorAct.successCriteria}"`);
  console.log(`minRepliesFor(mirror): ${minRepliesFor(mirrorAct)}`);

  const judgment = await judgeReply(AGE_BAND, mirrorAct, mirrorContext, reply);
  console.log("\nJudge result:", JSON.stringify(judgment, null, 2));

  const willAdvance = judgment.satisfied;
  const willNudge = !judgment.satisfied;

  console.log(`\nOutcome: ${willAdvance ? "ADVANCE (close mirror)" : `NUDGE (situation: ${judgment.situation})`}`);

  if (willNudge) {
    const state: ActState = { actIndex: MIRROR_ACT_INDEX, nudgeCount: 0, satisfiedCount: 0 };
    const prompt = buildSystemPrompt({ ageBand: AGE_BAND, state, nudge: { situation: judgment.situation } });
    const excerpt = prompt.substring(prompt.indexOf("You are at the Mirror"));
    console.log("\n--- MIRROR NUDGE PROMPT ---\n" + excerpt.substring(0, 500));
  }

  const ok = (willAdvance && expectedOutcome === "advance") || (willNudge && expectedOutcome === "nudge");
  console.log(`\n${ok ? "✓ PASS" : "✗ FAIL"} — expected: ${expectedOutcome}`);
  return ok;
}

async function main() {
  let passed = 0;
  let total = 0;

  // Case 1: flat "yeah I guess" — should NOT satisfy, produce a nudge
  const ok1 = await runMirrorCase(
    "Case 1 — flat agreement (should NUDGE)",
    "yeah I guess",
    "nudge",
  );
  total++; if (ok1) passed++;

  // Case 2: flat "yeah" alone
  const ok2 = await runMirrorCase(
    "Case 2 — single 'yeah' (should NUDGE)",
    "yeah",
    "nudge",
  );
  total++; if (ok2) passed++;

  // Case 3: rich engagement — confirms and adds specific detail
  const ok3 = await runMirrorCase(
    "Case 3 — rich engagement (should ADVANCE)",
    "yeah, actually the part about losing track of time is so true, I never noticed that",
    "advance",
  );
  total++; if (ok3) passed++;

  // Case 4: correction with nuance — also should advance
  const ok4 = await runMirrorCase(
    "Case 4 — correction with nuance (should ADVANCE)",
    "partly, but it's less about control and more about making something that didn't exist before",
    "advance",
  );
  total++; if (ok4) passed++;

  // Case 5: thin affirmation "sure" — should nudge
  const ok5 = await runMirrorCase(
    "Case 5 — thin 'sure' (should NUDGE)",
    "sure",
    "nudge",
  );
  total++; if (ok5) passed++;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Phase 6: ${passed}/${total} cases passed`);
  console.log("=".repeat(60) + "\n");

  if (passed < total) process.exit(1);
}

main().catch(console.error);
