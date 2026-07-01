import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { comicSessions } from "@/lib/comic/sessionStore";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { sessionId, audioBase64 } = body;

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const orchestrator = comicSessions.get(sessionId);
  if (!orchestrator) {
    return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });
  }

  const result = await orchestrator.handleUserMessage(audioBase64);
  return NextResponse.json(result);
}
