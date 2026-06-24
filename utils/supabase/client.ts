import { createBrowserClient } from "@supabase/ssr";

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (supabaseUrl) supabaseUrl = supabaseUrl.replace(/^["']|["']$/g, "").trim();
if (supabaseKey) supabaseKey = supabaseKey.replace(/^["']|["']$/g, "").trim();

export const createClient = () => {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables are missing.");
  }
  return createBrowserClient(
    supabaseUrl,
    supabaseKey,
  );
};
