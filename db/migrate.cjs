const { drizzle } = require("drizzle-orm/postgres-js");
const { migrate } = require("drizzle-orm/postgres-js/migrator");
const postgres = require("postgres");
const fs = require("fs");
const path = require("path");

// Simple local env loader
function loadEnv() {
  const envPath = path.resolve(__dirname, "../.env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    content.split("\n").forEach((line) => {
      const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1].trim();
        let value = (match[2] || "").trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
}

loadEnv();

let connectionString = process.env.DATABASE_URL;

if (connectionString) {
  connectionString = connectionString.replace(/^["']|["']$/g, "").trim();
}

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
