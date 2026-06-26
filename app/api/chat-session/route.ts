import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { isAgeBand, DIMENSION_KEYS, type ConversationState } from "@/lib/aiko/conversation";
import { getSession } from "@/lib/aiko/persist";

function normalizeStateForRead(raw: unknown): ConversationState {
  const s = (raw ?? {}) as Record<string, unknown>;
  // Old shape (pre-rewrite) — return safe defaults
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
  const c = s as Partial<ConversationState>;
  return {
    turnCount: typeof c.turnCount === "number" ? c.turnCount : 0,
    dimensions: (c.dimensions as ConversationState["dimensions"]) ?? {
      interestDomain:   { richness: "none", lastTurnIndex: null },
      naturalStrength:  { richness: "none", lastTurnIndex: null },
      realSelfSignal:   { richness: "none", lastTurnIndex: null },
      purposeDirection: { richness: "none", lastTurnIndex: null },
      paceStyle:        { richness: "none", lastTurnIndex: null },
    },
    consecutiveLowContentTurns: typeof c.consecutiveLowContentTurns === "number" ? c.consecutiveLowContentTurns : 0,
    endedReason: (c.endedReason as ConversationState["endedReason"]) ?? "ongoing",
  };
}

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

  const state = normalizeStateForRead(session.state);
  const dimensionsTouched = DIMENSION_KEYS.filter((k) => state.dimensions[k].richness !== "none").length;

  return NextResponse.json({
    session: {
      ageBand: session.ageBand,
      transcript: session.transcript,
      completed: Boolean(session.completedAt),
      turnCount: state.turnCount,
      dimensionsTouched,
      dimensionsTotal: DIMENSION_KEYS.length,
      endedReason: state.endedReason,
    },
  });
}
