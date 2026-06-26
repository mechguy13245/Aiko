import { anthropic } from "@ai-sdk/anthropic";
import { propagateAttributes } from "@langfuse/tracing";
import { generateObject, generateText, streamText, type ModelMessage } from "ai";
import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import {
  buildPostClosingSystemPrompt,
  buildSystemPrompt,
  isAgeBand,
  isFillerMessage,
  DIMENSION_KEYS,
  INITIAL_CONVERSATION_STATE,
  type ConversationState,
  type AgeBand,
} from "@/lib/aiko/conversation";
import type { TranscriptMessage } from "@/lib/aiko/persist";
import { classifyTurn } from "@/lib/aiko/judge";
import { profileSchema, type Profile } from "@/lib/aiko/profile";
import { getSession, logModerationEvent, upsertSession } from "@/lib/aiko/persist";
import {
  checkModeration,
  FALLBACK_ACT_MESSAGE,
  FALLBACK_CLOSING_MESSAGE,
  CALM_REDIRECT_MESSAGE,
  CALM_REDIRECT_ESCALATED_MESSAGE,
  SESSION_PAUSED_MESSAGE,
  SELF_HARM_RESPONSE,
} from "@/lib/aiko/moderation";
import { langfuseSpanProcessor } from "@/instrumentation";

export const maxDuration = 30;

const MAX_MESSAGES = 60;
const MODEL_TIMEOUT_MS = 20_000;
const RICHNESS_RANK: Record<string, number> = { none: 0, thin: 1, rich: 2 };

interface ChatRequestBody {
  ageBand: string;
  messages: { role: "user" | "assistant"; content: string }[];
}

function textResponse(text: string, headers?: Record<string, string>) {
  return new NextResponse(text, { headers: { "Content-Type": "text/plain; charset=utf-8", ...headers } });
}

function normalizeDimension(raw: unknown): ConversationState["dimensions"]["interestDomain"] {
  const VALID = ["none", "thin", "rich"] as const;
  const d = (raw ?? {}) as { richness?: unknown; lastTurnIndex?: unknown };
  return {
    richness: VALID.includes(d.richness as "none") ? (d.richness as "none" | "thin" | "rich") : "none",
    lastTurnIndex: typeof d.lastTurnIndex === "number" ? d.lastTurnIndex : null,
  };
}

function normalizeDimensions(raw: unknown): ConversationState["dimensions"] {
  const d = (raw ?? {}) as Partial<ConversationState["dimensions"]>;
  return {
    interestDomain:   normalizeDimension(d.interestDomain),
    naturalStrength:  normalizeDimension(d.naturalStrength),
    realSelfSignal:   normalizeDimension(d.realSelfSignal),
    purposeDirection: normalizeDimension(d.purposeDirection),
    paceStyle:        normalizeDimension(d.paceStyle),
  };
}

function normalizeState(raw: unknown): ConversationState {
  const s = (raw ?? {}) as Record<string, unknown>;
  // Old shape (pre-rewrite): had actIndex — restart clean rather than crash.
  if ("actIndex" in s) {
    return {
      turnCount: 0,
      dimensions: {
        interestDomain:   { richness: "none", lastTurnIndex: null },
        naturalStrength:  { richness: "none", lastTurnIndex: null },
        realSelfSignal:   { richness: "none", lastTurnIndex: null },
        purposeDirection: { richness: "none", lastTurnIndex: null },
        paceStyle:        { richness: "none", lastTurnIndex: null },
      },
      consecutiveLowContentTurns: 0,
      endedReason: "ongoing",
    };
  }
  const conv = s as Partial<ConversationState>;
  return {
    turnCount: typeof conv.turnCount === "number" ? conv.turnCount : 0,
    dimensions: normalizeDimensions(conv.dimensions),
    consecutiveLowContentTurns:
      typeof conv.consecutiveLowContentTurns === "number" ? conv.consecutiveLowContentTurns : 0,
    endedReason: (conv.endedReason as ConversationState["endedReason"]) ?? "ongoing",
  };
}

function progressHeaders(turnCount: number, dimensionsTouched: number, isClosing: boolean) {
  return {
    "X-Aiko-Closing": String(isClosing),
    "X-Aiko-Turn-Count": String(turnCount),
    "X-Aiko-Dimensions-Touched": String(dimensionsTouched),
  };
}

async function extractProfile(
  ageBand: string,
  sessionId: string,
  userId: string,
  transcript: { role: "user" | "assistant"; content: string }[],
) {
  return propagateAttributes(
    {
      traceName: "aiko-profile-extraction",
      sessionId,
      userId,
      tags: ["aiko", `age-${ageBand}`, "profile-extraction"],
    },
    async () => {
      const { object } = await generateObject({
        model: anthropic("claude-sonnet-4-6"),
        schema: profileSchema,
        system:
          "You analyze a completed reflection conversation between Aiko (an AI companion) and a student, and extract a structured profile across five dimensions. Generic values are a failure state — a phrase like \"curious learner\" or \"enjoys learning\" could describe any student and is not acceptable; every value must be specific enough that it could only describe this particular student, grounded in something they actually said. " +
          "CRITICAL: if a dimension was not genuinely touched on in the conversation, return null for both the dimension value and its confidence — do NOT infer a plausible-sounding value from thin air. null means 'we do not actually know this yet,' not 'low confidence guess.' " +
          "Never diagnose or use clinical language.",
        prompt: `Conversation transcript:\n\n${transcript.map((m) => `${m.role}: ${m.content}`).join("\n")}`,
        experimental_telemetry: { isEnabled: true },
        abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
      });
      return object;
    },
  );
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { ageBand, messages } = body;
  const sessionId = user.id;

  if (!isAgeBand(ageBand)) {
    return NextResponse.json({ error: "Invalid or missing ageBand" }, { status: 400 });
  }
  if (!Array.isArray(messages)) {
    return NextResponse.json({ error: "messages must be an array" }, { status: 400 });
  }

  const existingSession = await getSession(sessionId).catch(() => null);

  if (messages.length > MAX_MESSAGES) {
    return textResponse(FALLBACK_CLOSING_MESSAGE);
  }

  // ── Post-closing: conversation already finished ───────────────────────────
  if (existingSession?.completedAt) {
    const storedTranscript = existingSession.transcript as TranscriptMessage[];
    const closedState = normalizeState(existingSession.state);
    const closedTouched = DIMENSION_KEYS.filter((k) => closedState.dimensions[k].richness !== "none").length;

    if (messages.length <= storedTranscript.length) {
      const lastAssistantMessage = [...storedTranscript].reverse().find((m) => m.role === "assistant");
      return textResponse(
        lastAssistantMessage?.content ?? FALLBACK_CLOSING_MESSAGE,
        progressHeaders(closedState.turnCount, closedTouched, false),
      );
    }

    const latestUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (latestUserMessage) {
      const moderation = await checkModeration(latestUserMessage.content);
      if (moderation.selfHarm) {
        logModerationEvent({ sessionId, userId: user.id, ageBand, tier: "self-harm", flaggedContent: latestUserMessage.content }).catch((err) =>
          console.error("Moderation event logging failed:", err),
        );
        return textResponse(SELF_HARM_RESPONSE);
      }
      if (moderation.flagged) {
        const priorRedirects = messages.filter(
          (m) => m.role === "assistant" && (m.content === CALM_REDIRECT_MESSAGE || m.content === CALM_REDIRECT_ESCALATED_MESSAGE),
        ).length;
        const tier = priorRedirects >= 2 ? "paused" : priorRedirects >= 1 ? "escalated" : "calm";
        logModerationEvent({ sessionId, userId: user.id, ageBand, tier, flaggedContent: latestUserMessage.content }).catch((err) =>
          console.error("Moderation event logging failed:", err),
        );
        if (priorRedirects >= 2) return textResponse(SESSION_PAUSED_MESSAGE);
        if (priorRedirects >= 1) return textResponse(CALM_REDIRECT_ESCALATED_MESSAGE);
        return textResponse(CALM_REDIRECT_MESSAGE);
      }
    }

    const system = buildPostClosingSystemPrompt(ageBand);
    const modelMessages: ModelMessage[] = messages.map((m) => ({ role: m.role, content: m.content }));

    const response = await propagateAttributes(
      { traceName: "aiko-chat-turn", sessionId, userId: user.id, tags: ["aiko", `age-${ageBand}`, "post-closing-chat"] },
      async () => {
        try {
          const result = streamText({
            model: anthropic("claude-sonnet-4-6"),
            system,
            messages: modelMessages,
            experimental_telemetry: { isEnabled: true },
            abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
            onFinish: async (finalResult) => {
              const transcript = [...messages, { role: "assistant" as const, content: finalResult.text }];
              try {
                await upsertSession({
                  sessionId,
                  userId: user.id,
                  ageBand,
                  transcript,
                  state: closedState,
                  profile: (existingSession.profile as Profile | null) ?? undefined,
                  completed: true,
                });
              } catch (err) {
                console.error("Post-closing transcript persistence failed:", err);
              }
            },
            onError: ({ error }) => {
              console.error("Post-closing chat streaming failed:", error);
            },
          });
          return result.toTextStreamResponse({ headers: progressHeaders(closedState.turnCount, closedTouched, false) });
        } catch (err) {
          console.error("Post-closing chat generation failed to start:", err);
          return textResponse(FALLBACK_ACT_MESSAGE);
        }
      },
    );

    after(async () => await langfuseSpanProcessor.forceFlush());
    return response;
  }

  // ── Active conversation ────────────────────────────────────────────────────

  const currentState: ConversationState = existingSession
    ? normalizeState(existingSession.state)
    : { ...INITIAL_CONVERSATION_STATE, dimensions: { ...INITIAL_CONVERSATION_STATE.dimensions } };

  const latestUserMessage = [...messages].reverse().find((m) => m.role === "user");

  if (latestUserMessage) {
    const moderation = await checkModeration(latestUserMessage.content);
    if (moderation.selfHarm) {
      logModerationEvent({ sessionId, userId: user.id, ageBand, tier: "self-harm", flaggedContent: latestUserMessage.content }).catch((err) =>
        console.error("Moderation event logging failed:", err),
      );
      return textResponse(SELF_HARM_RESPONSE);
    }
    if (moderation.flagged) {
      const priorRedirects = messages.filter(
        (m) => m.role === "assistant" && (m.content === CALM_REDIRECT_MESSAGE || m.content === CALM_REDIRECT_ESCALATED_MESSAGE),
      ).length;
      const tier = priorRedirects >= 2 ? "paused" : priorRedirects >= 1 ? "escalated" : "calm";
      logModerationEvent({ sessionId, userId: user.id, ageBand, tier, flaggedContent: latestUserMessage.content }).catch((err) =>
        console.error("Moderation event logging failed:", err),
      );
      if (priorRedirects >= 2) return textResponse(SESSION_PAUSED_MESSAGE);
      if (priorRedirects >= 1) return textResponse(CALM_REDIRECT_ESCALATED_MESSAGE);
      return textResponse(CALM_REDIRECT_MESSAGE);
    }
  }

  // Breathe detection — pure heuristic, no model call. Counts consecutive
  // low-content turns and lets the dialog model leave space without a question.
  const preceding = messages.slice(0, -1).reverse().find((m) => m.role === "assistant");
  const isLowContent = latestUserMessage
    ? isFillerMessage(latestUserMessage.content, preceding?.content)
    : false;
  const newConsecutiveLowContent = isLowContent ? currentState.consecutiveLowContentTurns + 1 : 0;
  const breathe = newConsecutiveLowContent >= 2;

  // ── MAX_MESSAGES safety valve (forced close, not classifier-driven) ─────────
  if (messages.length >= MAX_MESSAGES) {
    const closingState: ConversationState = {
      ...currentState,
      turnCount: currentState.turnCount + 1,
      endedReason: "max-turns-safety-valve",
    };
    const closingSystem = buildSystemPrompt({ ageBand, state: closingState, isClosing: true });
    const modelMessages: ModelMessage[] = messages.map((m) => ({ role: m.role, content: m.content }));
    if (modelMessages.length === 0) modelMessages.push({ role: "user", content: "Let's begin." });

    let text: string;
    try {
      text = (
        await generateText({
          model: anthropic("claude-sonnet-4-6"),
          system: closingSystem,
          messages: modelMessages,
          experimental_telemetry: { isEnabled: true },
          abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
        })
      ).text;
      if (text.includes("?")) {
        text = (
          await generateText({
            model: anthropic("claude-sonnet-4-6"),
            system: `${closingSystem}\n\nYour previous attempt included a question mark, which is not allowed. Rewrite it as pure statements.`,
            messages: modelMessages,
            experimental_telemetry: { isEnabled: true },
            abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
          })
        ).text;
      }
    } catch (err) {
      console.error("Forced closing turn generation failed:", err);
      text = FALLBACK_CLOSING_MESSAGE;
    }

    const transcript = [...messages, { role: "assistant" as const, content: text }];
    const closedTouched = DIMENSION_KEYS.filter((k) => closingState.dimensions[k].richness !== "none").length;

    try {
      const profile = await extractProfile(ageBand, sessionId, user.id, transcript);
      await upsertSession({ sessionId, userId: user.id, ageBand, transcript, state: closingState, profile, completed: true });
    } catch (err) {
      console.error("Profile extraction or persistence failed:", err);
      await upsertSession({ sessionId, userId: user.id, ageBand, transcript, state: closingState, completed: true }).catch(
        (persistErr) => console.error("Transcript persistence also failed:", persistErr),
      );
    }

    after(async () => await langfuseSpanProcessor.forceFlush());
    return textResponse(text, progressHeaders(closingState.turnCount, closedTouched, true));
  }

  // ── Normal turn: single model call (Section-Based Dialog Policy, single-LLM) ─
  //
  // Architecture: one streamText call per turn, no pre-dialog classifier.
  // The dialog model sees the full conversation, the current dimension context
  // (as advisory backstop once turn >= 10), and decides on its own whether to
  // stay on the current thread or gently shift topic. If the child signals they
  // want to stop, the model closes gracefully guided by SHARED_GUARDRAILS.
  //
  // After streaming completes, classifyTurn runs in onFinish to update dimension
  // state for the NEXT turn's backstop context, and to detect if the child
  // signaled they want to stop (triggering profile extraction). This never
  // gates or forces the dialog model's choice — it is purely retrospective.

  const system = buildSystemPrompt({ ageBand, state: currentState, breathe });

  const modelMessages: ModelMessage[] = messages.map((m) => ({ role: m.role, content: m.content }));
  if (modelMessages.length === 0) {
    modelMessages.push({ role: "user", content: "Let's begin." });
  }

  const turnTag = breathe ? "breathe-turn" : `turn-${currentState.turnCount + 1}`;

  // Optimistic headers for this turn: turn count increments immediately,
  // dimension-touched count reflects the accumulated state from previous turns
  // (classification for this turn will update state in onFinish, visible next turn).
  const currentTouched = DIMENSION_KEYS.filter((k) => currentState.dimensions[k].richness !== "none").length;

  const response = await propagateAttributes(
    {
      traceName: "aiko-chat-turn",
      sessionId,
      userId: user.id,
      tags: ["aiko", `age-${ageBand}`, turnTag],
    },
    async () => {
      try {
        const result = streamText({
          model: anthropic("claude-sonnet-4-6"),
          system,
          messages: modelMessages,
          experimental_telemetry: { isEnabled: true },
          abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
          onFinish: async (finalResult) => {
            const newTurnCount = currentState.turnCount + 1;
            const transcript = [...messages, { role: "assistant" as const, content: finalResult.text }];

            // Classify the turn post-response — never pre-response. This is the
            // single-LLM pattern: the dialog model has already responded using its
            // own judgment; classification now updates context for future turns only.
            const classification = latestUserMessage
              ? await classifyTurn(ageBand, messages.slice(0, -1), latestUserMessage.content)
              : { dimensions: { interestDomain: "none" as const, naturalStrength: "none" as const, realSelfSignal: "none" as const, purposeDirection: "none" as const, paceStyle: "none" as const }, wantsToStop: false };

            // Merge: keep highest richness seen for each dimension.
            const newDimensions = { ...currentState.dimensions };
            for (const key of DIMENSION_KEYS) {
              const incoming = classification.dimensions[key];
              if (RICHNESS_RANK[incoming] > RICHNESS_RANK[currentState.dimensions[key].richness]) {
                newDimensions[key] = { richness: incoming, lastTurnIndex: newTurnCount };
              }
            }

            const nextState: ConversationState = {
              turnCount: newTurnCount,
              dimensions: newDimensions,
              consecutiveLowContentTurns: newConsecutiveLowContent,
              endedReason: classification.wantsToStop ? "child-signaled-done" : "ongoing",
            };

            if (classification.wantsToStop) {
              // Model already wrote a graceful close (SHARED_GUARDRAILS guides it
              // to do so). Extract profile and mark the session complete.
              try {
                const profile = await extractProfile(ageBand, sessionId, user.id, transcript);
                await upsertSession({ sessionId, userId: user.id, ageBand, transcript, state: nextState, profile, completed: true });
              } catch (err) {
                console.error("Profile extraction or persistence failed (wantsToStop):", err);
                await upsertSession({ sessionId, userId: user.id, ageBand, transcript, state: nextState, completed: true }).catch(
                  (persistErr) => console.error("Transcript persistence also failed:", persistErr),
                );
              }
            } else {
              try {
                await upsertSession({ sessionId, userId: user.id, ageBand, transcript, state: nextState, completed: false });
              } catch (err) {
                console.error("Transcript persistence failed:", err);
              }
            }
          },
          onError: ({ error }) => {
            console.error("Dialog turn streaming failed:", error);
          },
        });
        return result.toTextStreamResponse({
          headers: progressHeaders(currentState.turnCount + 1, currentTouched, false),
        });
      } catch (err) {
        console.error("Turn generation failed to start:", err);
        return textResponse(FALLBACK_ACT_MESSAGE);
      }
    },
  );

  after(async () => await langfuseSpanProcessor.forceFlush());
  return response;
}
