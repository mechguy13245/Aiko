import { db } from "@/db";
import { aikoSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
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
  completed: boolean;
}

export async function upsertSession({
  sessionId,
  userId,
  ageBand,
  transcript,
  profile,
  completed,
}: UpsertSessionArgs) {
  const completedAt = completed ? new Date() : null;
  await db
    .insert(aikoSessions)
    .values({
      id: sessionId,
      userId,
      ageBand,
      transcript,
      profile: profile ?? null,
      completedAt,
    })
    .onConflictDoUpdate({
      target: aikoSessions.id,
      set: {
        ageBand,
        transcript,
        profile: profile ?? null,
        completedAt,
      },
    });
}

export async function getSession(sessionId: string) {
  const [row] = await db.select().from(aikoSessions).where(eq(aikoSessions.id, sessionId)).limit(1);
  return row ?? null;
}
