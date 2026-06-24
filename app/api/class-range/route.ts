import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, user.id));

    return NextResponse.json({ classRange: profile?.classRange || null });
  } catch (error: any) {
    console.error("Failed to fetch class range:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { classRange } = body;

    if (!classRange) {
      return NextResponse.json({ error: "Class range is required" }, { status: 400 });
    }

    // Upsert the profile record
    await db
      .insert(profiles)
      .values({
        userId: user.id,
        classRange,
      })
      .onConflictDoUpdate({
        target: profiles.userId,
        set: { classRange, updatedAt: new Date() },
      });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to store class range:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
