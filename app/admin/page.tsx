import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { db } from "@/db";
import { aikoSessions } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export default async function AdminPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const adminEmails = getAdminEmails();
  if (!user?.email || !adminEmails.includes(user.email.toLowerCase())) {
    notFound();
  }

  const sessions = await db.select().from(aikoSessions).orderBy(desc(aikoSessions.createdAt)).limit(50);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 p-8">
      <h1 className="text-2xl font-light mb-6">Aiko sessions ({sessions.length})</h1>
      <div className="space-y-6">
        {sessions.map((session) => (
          <details key={session.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <summary className="cursor-pointer text-sm font-mono flex flex-wrap gap-3 items-center">
              <span>{session.id}</span>
              <span className="text-amber-400">{session.ageBand}</span>
              <span className="text-slate-500">{session.userId}</span>
              <span className="text-slate-500">
                {session.createdAt ? new Date(session.createdAt).toLocaleString() : ""}
              </span>
              <span className={session.completedAt ? "text-emerald-400" : "text-slate-500"}>
                {session.completedAt ? "completed" : "in progress"}
              </span>
            </summary>
            <div className="mt-4 space-y-4">
              {session.profile ? (
                <pre className="text-xs bg-slate-950/60 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(session.profile, null, 2)}
                </pre>
              ) : (
                <p className="text-xs text-slate-500">No profile extracted yet.</p>
              )}
              <pre className="text-xs bg-slate-950/60 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(session.transcript, null, 2)}
              </pre>
            </div>
          </details>
        ))}
      </div>
    </main>
  );
}
