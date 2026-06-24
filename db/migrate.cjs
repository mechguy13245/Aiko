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

function sanitizeConnectionString(url) {
  if (!url) return url;
  
  // Trim quotes and whitespace
  let sanitized = url.replace(/^["']|["']$/g, "").trim();

  // If there's a "#" or brackets in the password section, URL-encode them.
  const protocolIndex = sanitized.indexOf("://");
  if (protocolIndex !== -1) {
    const authorityStart = protocolIndex + 3;
    const atIndex = sanitized.lastIndexOf("@");
    if (atIndex > authorityStart) {
      const authority = sanitized.substring(authorityStart, atIndex);
      // Split user and password by the first ":" inside authority
      const colonIndex = authority.indexOf(":");
      if (colonIndex !== -1) {
        const username = authority.substring(0, colonIndex);
        const password = authority.substring(colonIndex + 1);
        
        // URL-encode special characters in the password
        const encodedPassword = password
          .replace(/#/g, "%23")
          .replace(/\[/g, "%5B")
          .replace(/\]/g, "%5D");
        
        // Reconstruct the sanitized URL
        sanitized = sanitized.substring(0, authorityStart) + 
                    username + ":" + encodedPassword + 
                    sanitized.substring(atIndex);
      }
    }
  }

  return sanitized;
}

const connectionString = sanitizeConnectionString(process.env.DATABASE_URL);

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
