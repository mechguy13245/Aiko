import { openai } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";
import { NextResponse } from "next/server";
import { buildSystemPrompt, isAgeBand } from "@/lib/aiko/conversation";

export const maxDuration = 30;

interface ChatRequestBody {
  ageBand: string;
  messages: { role: "user" | "assistant"; content: string }[];
}

export async function POST(request: Request) {
  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { ageBand, messages } = body;

  if (!isAgeBand(ageBand)) {
    return NextResponse.json({ error: "Invalid or missing ageBand" }, { status: 400 });
  }
  if (!Array.isArray(messages)) {
    return NextResponse.json({ error: "messages must be an array" }, { status: 400 });
  }

  const userTurnCount = messages.filter((m) => m.role === "user").length;
  const system = buildSystemPrompt(ageBand, userTurnCount);

  const modelMessages: ModelMessage[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system,
    messages: modelMessages,
    experimental_telemetry: {
      isEnabled: true,
      functionId: "aiko-conversation",
      metadata: { ageBand, actIndex: userTurnCount },
    },
  });

  return result.toTextStreamResponse();
}
