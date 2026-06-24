import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const todos = pgTable("todos", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

export const profiles = pgTable("profiles", {
  userId: text("user_id").primaryKey(),
  classRange: text("class_range").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

