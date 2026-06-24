import { jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

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
  profile: jsonb("profile"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

