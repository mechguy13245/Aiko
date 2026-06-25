import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getActCount, isAgeBand, type ActState } from "@/lib/aiko/conversation";
import { getSession } from "@/lib/aiko/persist";

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await getSession(user.id);
  if (!session) {
    return NextResponse.json({ session: null });
  }

  const state = session.state as ActState;

  return NextResponse.json({
    session: {
      ageBand: session.ageBand,
      transcript: session.transcript,
      completed: Boolean(session.completedAt),
      actIndex: state?.actIndex ?? 0,
      actCount: isAgeBand(session.ageBand) ? getActCount(session.ageBand) : 0,
    },
  });
}
