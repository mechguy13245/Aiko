import { openai } from "@ai-sdk/openai";
import { propagateAttributes } from "@langfuse/tracing";
import { generateObject, generateText, streamText, type ModelMessage } from "ai";
import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { buildSystemPrompt, isAgeBand, isClosingTurn } from "@/lib/aiko/conversation";
import { profileSchema } from "@/lib/aiko/profile";
import { upsertSession } from "@/lib/aiko/persist";
import { langfuseSpanProcessor } from "@/instrumentation";

export const maxDuration = 30;

interface ChatRequestBody {
  ageBand: string;
  sessionId: string;
  messages: { role: "user" | "assistant"; content: string }[];
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

  const { ageBand, sessionId, messages } = body;

  if (!isAgeBand(ageBand)) {
    return NextResponse.json({ error: "Invalid or missing ageBand" }, { status: 400 });
  }
  if (typeof sessionId !== "string" || !sessionId) {
    return NextResponse.json({ error: "Invalid or missing sessionId" }, { status: 400 });
  }
  if (!Array.isArray(messages)) {
    return NextResponse.json({ error: "messages must be an array" }, { status: 400 });
  }

  const userTurnCount = messages.filter((m) => m.role === "user").length;
  const system = buildSystemPrompt(ageBand, userTurnCount);
  const closingTurn = isClosingTurn(ageBand, userTurnCount);

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
      tags: ["aiko", `age-${ageBand}`, closingTurn ? "closing-turn" : "act-turn"],
    },
    async () => {
      // The closing turn must never ask a question. Models occasionally slip a
      // question in anyway, so generate up-front and retry once before replying.
      if (closingTurn) {
        let text = (
          await generateText({
            model: openai("gpt-5.4-mini"),
            system,
            messages: modelMessages,
            experimental_telemetry: { isEnabled: true },
          })
        ).text;

        if (text.includes("?")) {
          text = (
            await generateText({
              model: openai("gpt-5.4-mini"),
              system: `${system}\n\nYour previous attempt included a question mark, which is not allowed. Rewrite it as pure statements.`,
              messages: modelMessages,
              experimental_telemetry: { isEnabled: true },
            })
          ).text;
        }

        const transcript = [...messages, { role: "assistant" as const, content: text }];

        try {
          const profile = await extractProfile(ageBand, sessionId, user.id, transcript);
          await upsertSession({
            sessionId,
            userId: user.id,
            ageBand,
            transcript,
            profile,
            completed: true,
          });
        } catch (err) {
          console.error("Profile extraction or persistence failed:", err);
          // Still persist the transcript even if extraction failed.
          await upsertSession({ sessionId, userId: user.id, ageBand, transcript, completed: true }).catch(
            (persistErr) => console.error("Transcript persistence also failed:", persistErr),
          );
        }

        return new NextResponse(text, {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }

      const result = streamText({
        model: openai("gpt-5.4-mini"),
        system,
        messages: modelMessages,
        experimental_telemetry: { isEnabled: true },
        onFinish: async (finalResult) => {
          const transcript = [...messages, { role: "assistant" as const, content: finalResult.text }];
          try {
            await upsertSession({ sessionId, userId: user.id, ageBand, transcript });
          } catch (err) {
            console.error("Transcript persistence failed:", err);
          }
        },
      });

      return result.toTextStreamResponse();
    },
  );

  // Critical for serverless: flush spans before the function terminates.
  after(async () => await langfuseSpanProcessor.forceFlush());

  return response;
}
