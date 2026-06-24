import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

async function main() {
  if (!connectionString) {
    console.log("DATABASE_URL is not set. Skipping database migrations.");
    return;
  }

  if (connectionString.includes("[YOUR") || connectionString.includes("localhost")) {
    console.log("DATABASE_URL contains a placeholder or localhost. Skipping database migrations.");
    return;
  }

  console.log("Running database migrations via Drizzle...");
  
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);

  try {
    await migrate(db, { migrationsFolder: "./supabase/migrations" });
    console.log("Database migrations completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("Unexpected error during migration:", err);
  process.exit(1);
});
