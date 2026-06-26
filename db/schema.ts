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
  // state is ConversationState JSON. {} is a safe default — normalizeState
  // handles partial/missing fields and the old actIndex shape gracefully.
  state: jsonb("state").notNull().default({}),
  profile: jsonb("profile"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Audit log: every time a moderation flag fires, a row lands here.
// Intentionally append-only — no updates, no deletes.
// NOTE(product): review/notification workflow still pending product decision.
export const aikoModerationEvents = pgTable("aiko_moderation_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: text("session_id").notNull(),
  userId: text("user_id").notNull(),
  ageBand: text("age_band").notNull(),
  tier: text("tier").notNull(),
  flaggedContent: text("flagged_content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
