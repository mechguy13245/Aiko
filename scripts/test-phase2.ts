/**
 * Phase 2 unit tests — isFillerMessage context-awareness.
 * Run with: npx tsx scripts/test-phase2.ts
 */

import { isFillerMessage } from "../lib/aiko/conversation";

interface TestCase {
  label: string;
  text: string;
  preceding?: string;
  expected: boolean;
}

const cases: TestCase[] = [
  // --- Unconditional filler (should always be filler) ---
  {
    label: "idk after open question",
    text: "idk",
    preceding: "What do you actually enjoy doing in your free time?",
    expected: true,
  },
  {
    label: "dunno after anything",
    text: "dunno",
    preceding: "Does that sound right to you?",
    expected: true,
  },
  {
    label: "lol after anything",
    text: "lol",
    preceding: "What is it about chess that draws you in?",
    expected: true,
  },
  {
    label: "... (ellipsis) alone",
    text: "...",
    preceding: "What do you like to do?",
    expected: true,
  },

  // --- Context-dependent tokens after a YES/NO question (should NOT be filler) ---
  {
    label: "nah after yes/no question",
    text: "nah",
    preceding: "Do you care about the characters?",
    expected: false,
  },
  {
    label: "yeah after 'does that sound right?' (mirror act confirmation)",
    text: "yeah",
    preceding: "Does that sound right to you?",
    expected: false,
  },
  {
    label: "yes after 'is it' question",
    text: "yes",
    preceding: "Is it more that you like the strategy, or the social part?",
    expected: false,
  },
  {
    label: "sure after closed question",
    text: "sure",
    preceding: "Would you say you prefer working alone or in a group?",
    expected: false,
  },
  {
    label: "nope after yes/no question",
    text: "nope",
    preceding: "Did you enjoy it?",
    expected: false,
  },
  {
    label: "ok after can question",
    text: "ok",
    preceding: "Can you tell me a bit more about that?",
    expected: false,
  },

  // --- Context-dependent tokens after an OPEN question (should be filler) ---
  {
    label: "yeah after open question",
    text: "yeah",
    preceding: "What makes you lose track of time completely?",
    expected: true,
  },
  {
    label: "nah after open question",
    text: "nah",
    preceding: "Tell me more about what you enjoy.",
    expected: true,
  },
  {
    label: "sure after open question (no question mark heuristic)",
    text: "sure",
    preceding: "What else is there that you do with your free time",
    expected: true, // no "?" so not a question
  },

  // --- No preceding message ---
  {
    label: "yeah with no preceding message",
    text: "yeah",
    preceding: undefined,
    expected: true,
  },

  // --- Genuinely short but meaningful reply after open question ---
  {
    label: "short substantive reply not caught by regex",
    text: "chess",
    preceding: "What do you do in your free time?",
    expected: false, // length >= 5, not a filler token
  },
];

let passed = 0;
let failed = 0;

for (const { label, text, preceding, expected } of cases) {
  const result = isFillerMessage(text, preceding);
  const ok = result === expected;
  if (ok) {
    passed++;
    console.log(`  ✓  ${label}`);
  } else {
    failed++;
    console.log(`  ✗  ${label}`);
    console.log(`       text: "${text}", preceding: "${preceding ?? "(none)"}"`);
    console.log(`       expected: ${expected}, got: ${result}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
