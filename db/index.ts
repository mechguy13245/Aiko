import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function sanitizeConnectionString(url: string | undefined): string | undefined {
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

// We provide a fallback during build/dev if it isn't set yet.
const client = postgres(
  connectionString || "postgresql://postgres:postgres@localhost:5432/postgres",
  { prepare: false }
);

export const db = drizzle(client, { schema });
