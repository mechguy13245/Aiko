/**
 * Chess regression test — premature abstraction bug.
 *
 * Bug: after "the way she is all powerful and can do anything" (a description
 * of the chess queen, not the student), Aiko jumped to "Do you find yourself
 * thinking that way in other areas too, like wanting to be the one with the
 * most options and control?" — a pre-packaged interpretation phrased as a
 * confirming question.
 *
 * Fix verifies:
 *   1. Judge correctly classifies as rich-needs-anchoring (not rich-ready-to-deepen)
 *   2. The resulting deepen prompt stays concrete, not personal
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

import { judgeReply } from "../lib/aiko/judge";
import { buildSystemPrompt, getAct, type ActState } from "../lib/aiko/conversation";

const AGE_BAND = "9-12" as const;
const FREE_TIME_ACT_INDEX = 0; // freedom-vs-structure is always first

const act = getAct(AGE_BAND, FREE_TIME_ACT_INDEX)!;

function sep(label: string) {
  console.log("\n" + "=".repeat(60));
  console.log("  " + label);
  console.log("=".repeat(60));
}

async function runCase(
  label: string,
  context: { role: "user" | "assistant"; content: string }[],
  reply: string,
  expectedRichness: "thin" | "rich-needs-anchoring" | "rich-ready-to-deepen",
  checkDeepen?: (prompt: string) => boolean,
) {
  sep(label);
  console.log(`\nReply under test: "${reply}"`);

  const judgment = await judgeReply(AGE_BAND, act, context, reply);
  console.log("\nJudge result:", JSON.stringify(judgment, null, 2));

  const richnessOk = judgment.richness === expectedRichness;
  console.log(`\nRichness: ${judgment.richness} — expected ${expectedRichness} → ${richnessOk ? "✓ PASS" : "✗ FAIL"}`);

  let deepenOk = true;
  if (judgment.satisfied && checkDeepen) {
    const state: ActState = { actIndex: FREE_TIME_ACT_INDEX, nudgeCount: 1, satisfiedCount: 1 };
    const prompt = buildSystemPrompt({ ageBand: AGE_BAND, state, deepen: { richness: judgment.richness } });
    deepenOk = checkDeepen(prompt);
    console.log(`\nDeepen prompt check: ${deepenOk ? "✓ PASS" : "✗ FAIL"}`);
    if (!deepenOk) {
      const excerpt = prompt.slice(prompt.lastIndexOf("\n\n") - 100).trim();
      console.log("Deepen prompt excerpt:\n" + excerpt.slice(0, 600));
    }
  }

  return richnessOk && deepenOk;
}

async function main() {
  let passed = 0;
  let total = 0;

  // Chess context: Aiko asked about what they like in chess; student named the queen
  const chessContext = [
    { role: "assistant" as const, content: "What do you actually like doing when you have free time?" },
    { role: "user" as const, content: "I play chess a lot" },
    { role: "assistant" as const, content: "What's your favourite piece?" },
  ];

  // Case 1: describes queen's power — should be rich-needs-anchoring, NOT rich-ready-to-deepen
  // deepen prompt must NOT pivot to "do you find yourself wanting control" etc.
  const ok1 = await runCase(
    "Case 1 — chess queen power description (external, not self-referential)",
    chessContext,
    "the way she is all powerful and can do anything",
    "rich-needs-anchoring",
    (prompt) => {
      // Must stay concrete on the chess piece
      const hasPrePackaged = /find yourself.*control|wanting.*control|do you feel.*same.*life/i.test(prompt);
      return !hasPrePackaged;
    },
  );
  total++; if (ok1) passed++;

  // Case 2: likes going anywhere — still about the piece, not about themselves
  const ok2 = await runCase(
    "Case 2 — 'I like that she can go anywhere' (liking ≠ self-reflection)",
    chessContext,
    "I like that she can go anywhere on the board",
    "rich-needs-anchoring",
  );
  total++; if (ok2) passed++;

  // Case 3: explicit self-reference — now rich-ready-to-deepen
  const ok3 = await runCase(
    "Case 3 — 'I feel like that too, I hate being restricted' (explicit self-reference → ready)",
    [...chessContext, { role: "assistant" as const, content: "What is it about the queen that draws you in?" }],
    "I feel like that too, I hate being restricted to one place",
    "rich-ready-to-deepen",
  );
  total++; if (ok3) passed++;

  // Case 4: "I always want to be the one in control" — also self-referential
  const ok4 = await runCase(
    "Case 4 — 'I always want to be the one in control' (direct self-statement → ready)",
    [...chessContext, { role: "assistant" as const, content: "What is it about the queen that draws you in?" }],
    "I always want to be the one in control and the queen is the only piece that actually can be",
    "rich-ready-to-deepen",
  );
  total++; if (ok4) passed++;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Chess regression: ${passed}/${total} cases passed`);
  console.log("=".repeat(60) + "\n");

  if (passed < total) process.exit(1);
}

main().catch(console.error);
