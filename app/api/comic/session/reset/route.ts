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
  const { sessionId } = body;

  if (sessionId) {
    const orchestrator = comicSessions.get(sessionId);
    orchestrator?.reset();
    comicSessions.delete(sessionId);
  }

  return NextResponse.json({ success: true });
}
