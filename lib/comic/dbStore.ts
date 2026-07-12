import { db } from "@/db";
import { comicStorySessions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import type { ComicPanel } from "./memoryStore";

export async function upsertComicSession(
  sessionId: string,
  userId: string,
  panels: ComicPanel[]
) {
  await db
    .insert(comicStorySessions)
    .values({ id: sessionId, userId, panels: panels as unknown as object[] })
    .onConflictDoUpdate({
      target: comicStorySessions.id,
      set: { panels: panels as unknown as object[] },
    });
}

export async function markComicSessionComplete(sessionId: string) {
  await db
    .update(comicStorySessions)
    .set({ completedAt: new Date() })
    .where(eq(comicStorySessions.id, sessionId));
}

export async function getComicStoriesByUser(userId: string) {
  return db
    .select()
    .from(comicStorySessions)
    .where(eq(comicStorySessions.userId, userId))
    .orderBy(desc(comicStorySessions.createdAt));
}
