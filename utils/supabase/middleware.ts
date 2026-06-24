import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (supabaseUrl) supabaseUrl = supabaseUrl.replace(/^["']|["']$/g, "").trim();
if (supabaseKey) supabaseKey = supabaseKey.replace(/^["']|["']$/g, "").trim();

export const createClient = async (request: NextRequest) => {
  // Create an unmodified response
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    },
  );

  // Refresh session if needed
  try {
    await supabase.auth.getUser();
  } catch (error) {
    // Ignore errors here to avoid blocking requests if Supabase fails
  }

  return supabaseResponse;
};
