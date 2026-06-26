import { db } from "@/db";
import { aikoModerationEvents, aikoSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { AgeBand, ConversationState } from "@/lib/aiko/conversation";
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
  state: ConversationState;
  profile?: Profile;
  completed: boolean;
}

export async function upsertSession({
  sessionId,
  userId,
  ageBand,
  transcript,
  state,
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
      state,
      profile: profile ?? null,
      completedAt,
    })
    .onConflictDoUpdate({
      target: aikoSessions.id,
      set: {
        ageBand,
        transcript,
        state,
        profile: profile ?? null,
        completedAt,
      },
    });
}

export async function getSession(sessionId: string) {
  const [row] = await db.select().from(aikoSessions).where(eq(aikoSessions.id, sessionId)).limit(1);
  return row ?? null;
}

export type ModerationTier = "self-harm" | "calm" | "escalated" | "paused";

/**
 * Fire-and-forget: write a moderation audit record.
 * Caller must NOT await this — it must not slow the student-facing response.
 * NOTE(product): a review/notification workflow for who gets alerted and how
 * fast is still a pending product decision. This function just ensures the
 * data is captured. Query via:
 *   SELECT * FROM aiko_moderation_events ORDER BY created_at DESC;
 */
export async function logModerationEvent({
  sessionId,
  userId,
  ageBand,
  tier,
  flaggedContent,
}: {
  sessionId: string;
  userId: string;
  ageBand: AgeBand;
  tier: ModerationTier;
  flaggedContent: string;
}) {
  await db.insert(aikoModerationEvents).values({
    sessionId,
    userId,
    ageBand,
    tier,
    flaggedContent,
  });
}
