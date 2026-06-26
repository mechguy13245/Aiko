import { jsonb, pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const todos = pgTable("todos", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

export const profiles = pgTable("profiles", {
  userId: text("user_id").primaryKey(),
  classRange: text("class_range").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const aikoSessions = pgTable("aiko_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  ageBand: text("age_band").notNull(),
  transcript: jsonb("transcript").notNull().default([]),
  state: jsonb("state").notNull().default({ actIndex: 0, nudgeCount: 0 }),
  profile: jsonb("profile"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Audit log: every time a moderation flag fires, a row lands here.
// This is intentionally append-only — no updates, no deletes.
// NOTE(product): who gets notified, how fast, and how to review is a product
// decision still pending. This table just ensures the data is captured and
// queryable. A real review/notification workflow should be added before
// wider rollout.
export const aikoModerationEvents = pgTable("aiko_moderation_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: text("session_id").notNull(),
  userId: text("user_id").notNull(),
  ageBand: text("age_band").notNull(),
  tier: text("tier").notNull(), // "self-harm" | "calm" | "escalated" | "paused"
  flaggedContent: text("flagged_content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
