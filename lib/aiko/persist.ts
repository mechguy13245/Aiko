import { db } from "@/db";
import { aikoSessions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import type { AgeBand } from "@/lib/aiko/conversation";
import type { Profile } from "@/lib/aiko/profile";

export interface TranscriptMessage {
  role: "user" | "assistant";
  content: string;
}

interface UpsertSessionArgs {
  sessionId: string;
  userId: string;
  ageBand: AgeBand;
  transcript: TranscriptMessage[];
  profile?: Profile;
  completed?: boolean;
}

export async function upsertSession({
  sessionId,
  userId,
  ageBand,
  transcript,
  profile,
  completed,
}: UpsertSessionArgs) {
  await db
    .insert(aikoSessions)
    .values({
      id: sessionId,
      userId,
      ageBand,
      transcript,
      profile: profile ?? null,
      completedAt: completed ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: aikoSessions.id,
      set: {
        transcript,
        ...(profile ? { profile } : {}),
        ...(completed ? { completedAt: sql`now()` } : {}),
      },
    });
}

export async function getCompletedSession(sessionId: string) {
  const [row] = await db.select().from(aikoSessions).where(eq(aikoSessions.id, sessionId)).limit(1);
  if (!row || !row.completedAt) return null;
  return row;
}
