import { openai } from "@ai-sdk/openai";
import { propagateAttributes } from "@langfuse/tracing";
import { generateObject, generateText, streamText, type ModelMessage } from "ai";
import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import {
  buildSystemPrompt,
  getAct,
  getActCount,
  isAgeBand,
  isClosingTurn,
  MAX_NUDGES_PER_ACT,
  INITIAL_ACT_STATE,
  type ActState,
  type AgeBand,
  type ReplySituation,
} from "@/lib/aiko/conversation";
import { judgeReply } from "@/lib/aiko/judge";
import { profileSchema } from "@/lib/aiko/profile";
import { getSession, upsertSession } from "@/lib/aiko/persist";
import {
  checkModeration,
  FALLBACK_ACT_MESSAGE,
  FALLBACK_CLOSING_MESSAGE,
  CALM_REDIRECT_MESSAGE,
  SELF_HARM_RESPONSE,
} from "@/lib/aiko/moderation";
import { langfuseSpanProcessor } from "@/instrumentation";

export const maxDuration = 30;

// Hard ceiling on raw message count per session. A real conversation never
// gets close to this; it exists to bound cost/abuse from a client sending an
// arbitrarily long fabricated history directly against the API.
const MAX_MESSAGES = 60;
const MODEL_TIMEOUT_MS = 20_000;

interface ChatRequestBody {
  ageBand: string;
  messages: { role: "user" | "assistant"; content: string }[];
}

function textResponse(text: string, headers?: Record<string, string>) {
  return new NextResponse(text, { headers: { "Content-Type": "text/plain; charset=utf-8", ...headers } });
}

function progressHeaders(ageBand: AgeBand, state: ActState, closing: boolean) {
  return {
    "X-Aiko-Closing": String(closing),
    "X-Aiko-Act-Index": String(state.actIndex),
    "X-Aiko-Act-Count": String(getActCount(ageBand)),
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
        model: openai("gpt-5.4-mini"),
        schema: profileSchema,
        system:
          "You analyze a completed reflection conversation between Aiko (an AI companion) and a student, and extract a short strengths-based profile. Be warm, specific, and avoid generic statements. Never diagnose or use clinical language.",
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

  // One persistent session per user — there is never more than one row per
  // user in aikoSessions, so the user's id doubles as the session id. This
  // means a returning user always resumes the same conversation rather than
  // starting a fresh, disconnected one.
  const sessionId = user.id;

  if (!isAgeBand(ageBand)) {
    return NextResponse.json({ error: "Invalid or missing ageBand" }, { status: 400 });
  }
  if (!Array.isArray(messages)) {
    return NextResponse.json({ error: "messages must be an array" }, { status: 400 });
  }

  const existingSession = await getSession(sessionId).catch(() => null);

  // Idempotent re-close: if this session already finished, replay the saved
  // closing message instead of re-running the model (and re-billing) for
  // every extra request a client might send after closing.
  if (existingSession?.completedAt) {
    const transcript = existingSession.transcript as { role: "user" | "assistant"; content: string }[];
    const lastAssistantMessage = [...transcript].reverse().find((m) => m.role === "assistant");
    const closedState = existingSession.state as ActState;
    return textResponse(lastAssistantMessage?.content ?? FALLBACK_CLOSING_MESSAGE, progressHeaders(ageBand, closedState, true));
  }

  if (messages.length > MAX_MESSAGES) {
    return textResponse(FALLBACK_CLOSING_MESSAGE);
  }

  const currentState: ActState = (existingSession?.state as ActState) ?? INITIAL_ACT_STATE;
  const latestUserMessage = [...messages].reverse().find((m) => m.role === "user");

  if (latestUserMessage) {
    const moderation = await checkModeration(latestUserMessage.content);
    if (moderation.selfHarm) {
      return textResponse(SELF_HARM_RESPONSE);
    }
    if (moderation.flagged) {
      return textResponse(CALM_REDIRECT_MESSAGE);
    }
  }

  // Judge whether the latest reply actually satisfies what this act needs,
  // rather than assuming any non-empty reply is good enough. A reply that
  // falls short earns a nudge (with an example on the second attempt)
  // instead of silently advancing past it.
  let nextState: ActState = currentState;
  let nudge: { situation: ReplySituation } | undefined;

  if (latestUserMessage) {
    const act = getAct(ageBand, currentState.actIndex);
    if (act) {
      const judgment = await judgeReply(ageBand, act, messages.slice(0, -1), latestUserMessage.content);
      if (judgment.satisfied) {
        nextState = { actIndex: currentState.actIndex + 1, nudgeCount: 0 };
      } else if (currentState.nudgeCount < MAX_NUDGES_PER_ACT) {
        nextState = { actIndex: currentState.actIndex, nudgeCount: currentState.nudgeCount + 1 };
        nudge = { situation: judgment.situation };
      } else {
        // Already nudged the max number of times — move on rather than stall.
        nextState = { actIndex: currentState.actIndex + 1, nudgeCount: 0 };
      }
    }
  }

  const system = buildSystemPrompt({ ageBand, state: nextState, nudge });
  const closingTurn = isClosingTurn(ageBand, nextState.actIndex);

  const modelMessages: ModelMessage[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // The model needs at least one message; seed the very first turn so Aiko
  // opens the conversation without the client having to send a fake message.
  if (modelMessages.length === 0) {
    modelMessages.push({ role: "user", content: "Let's begin." });
  }

  const response = await propagateAttributes(
    {
      traceName: "aiko-chat-turn",
      sessionId,
      userId: user.id,
      tags: [
        "aiko",
        `age-${ageBand}`,
        closingTurn ? "closing-turn" : nudge ? "nudge-turn" : "act-turn",
      ],
    },
    async () => {
      // The closing turn must never ask a question. Models occasionally slip a
      // question in anyway, so generate up-front and retry once before replying.
      if (closingTurn) {
        let text: string;
        try {
          text = (
            await generateText({
              model: openai("gpt-5.4-mini"),
              system,
              messages: modelMessages,
              experimental_telemetry: { isEnabled: true },
              abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
            })
          ).text;

          if (text.includes("?")) {
            text = (
              await generateText({
                model: openai("gpt-5.4-mini"),
                system: `${system}\n\nYour previous attempt included a question mark, which is not allowed. Rewrite it as pure statements.`,
                messages: modelMessages,
                experimental_telemetry: { isEnabled: true },
                abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
              })
            ).text;
          }
        } catch (err) {
          console.error("Closing turn generation failed:", err);
          text = FALLBACK_CLOSING_MESSAGE;
        }

        const transcript = [...messages, { role: "assistant" as const, content: text }];

        try {
          const profile = await extractProfile(ageBand, sessionId, user.id, transcript);
          await upsertSession({
            sessionId,
            userId: user.id,
            ageBand,
            transcript,
            state: nextState,
            profile,
            completed: true,
          });
        } catch (err) {
          console.error("Profile extraction or persistence failed:", err);
          // Still persist the transcript even if extraction failed.
          await upsertSession({ sessionId, userId: user.id, ageBand, transcript, state: nextState, completed: true }).catch(
            (persistErr) => console.error("Transcript persistence also failed:", persistErr),
          );
        }

        return textResponse(text, progressHeaders(ageBand, nextState, true));
      }

      try {
        const result = streamText({
          model: openai("gpt-5.4-mini"),
          system,
          messages: modelMessages,
          experimental_telemetry: { isEnabled: true },
          abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
          onFinish: async (finalResult) => {
            const transcript = [...messages, { role: "assistant" as const, content: finalResult.text }];
            try {
              await upsertSession({ sessionId, userId: user.id, ageBand, transcript, state: nextState, completed: false });
            } catch (err) {
              console.error("Transcript persistence failed:", err);
            }
          },
          onError: ({ error }) => {
            console.error("Act turn streaming failed:", error);
          },
        });

        return result.toTextStreamResponse({ headers: progressHeaders(ageBand, nextState, false) });
      } catch (err) {
        console.error("Act turn generation failed to start:", err);
        return textResponse(FALLBACK_ACT_MESSAGE);
      }
    },
  );

  // Critical for serverless: flush spans before the function terminates.
  after(async () => await langfuseSpanProcessor.forceFlush());

  return response;
}
