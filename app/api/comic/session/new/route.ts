import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { ComicOrchestrator } from "@/lib/comic/orchestrator";
import { comicSessions } from "@/lib/comic/sessionStore";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function POST() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = generateId();
  const orchestrator = new ComicOrchestrator({ sessionId });
  comicSessions.set(sessionId, orchestrator);

  return NextResponse.json({
    sessionId,
    message: "Hi! I'm so excited to hear your story! What's it about? 🌟",
  });
}
