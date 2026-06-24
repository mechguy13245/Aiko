import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let connectionString = process.env.DATABASE_URL;

if (connectionString) {
  connectionString = connectionString.replace(/^["']|["']$/g, "").trim();
}

// We provide a fallback during build/dev if it isn't set yet.
const client = postgres(
  connectionString || "postgresql://postgres:postgres@localhost:5432/postgres",
  { prepare: false }
);

export const db = drizzle(client, { schema });
