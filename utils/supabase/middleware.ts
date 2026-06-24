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
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (error) {
    // Ignore errors here to avoid blocking requests if Supabase fails
  }

  const url = new URL(request.url);

  // If user is not logged in and not on /auth, redirect to /auth
  if (!user && url.pathname !== "/auth" && url.pathname !== "/auth/callback") {
    const redirectResponse = NextResponse.redirect(new URL("/auth", request.url));
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, {
        path: cookie.path,
        domain: cookie.domain,
        maxAge: cookie.maxAge,
        expires: cookie.expires,
        sameSite: cookie.sameSite,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
      });
    });
    return redirectResponse;
  }

  // If user is logged in and visits /auth, redirect to /
  if (user && url.pathname === "/auth") {
    const redirectResponse = NextResponse.redirect(new URL("/", request.url));
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, {
        path: cookie.path,
        domain: cookie.domain,
        maxAge: cookie.maxAge,
        expires: cookie.expires,
        sameSite: cookie.sameSite,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
      });
    });
    return redirectResponse;
  }

  return supabaseResponse;
};
