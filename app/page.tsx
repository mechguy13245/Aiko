import { db } from "@/db";
import { todos } from "@/db/schema";
import Link from "next/link";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Drizzle Todo Integration Showcase",
  description: "Viewing data loaded server-side from PostgreSQL via Drizzle ORM inside our Next.js application.",
};

export const dynamic = "force-dynamic";

export default async function Page() {
  async function handleLogout() {
    "use server";
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await supabase.auth.signOut();
    redirect("/auth");
  }

  let todoList: { id: number; name: string }[] = [];
  let fetchError = false;
  let errorMessage = "";

  try {
    todoList = await db.select().from(todos);
  } catch (error: any) {
    console.error("Failed to fetch todos via Drizzle:", error);
    fetchError = true;
    errorMessage = error?.message || "An unexpected error occurred.";
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-xl w-full bg-slate-900/50 border border-slate-700/30 backdrop-blur-md rounded-3xl p-8 shadow-2xl space-y-8">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-slate-100" />
            </div>
            <div>
              <h1 className="text-xl font-light text-slate-100 tracking-wide">Drizzle Todos</h1>
              <p className="text-xs text-slate-400">PostgreSQL ORM fetching</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/chat"
              className="text-xs px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/50 rounded-xl transition-all hover:scale-[1.02]"
            >
              Launch Chat →
            </Link>
            <form action={handleLogout}>
              <button
                type="submit"
                className="text-xs px-4 py-2 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 border border-rose-900/30 rounded-xl transition-all hover:scale-[1.02] cursor-pointer"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>

        <div className="space-y-4">
          {fetchError ? (
            <div className="text-center py-6 space-y-2 border border-rose-500/20 bg-rose-500/5 rounded-2xl p-4">
              <p className="text-rose-400 text-sm">Failed to connect to database.</p>
              {errorMessage && (
                <p className="text-xs text-rose-300 font-mono bg-rose-950/40 p-2 rounded border border-rose-900/30 break-words">
                  {errorMessage}
                </p>
              )}
              <p className="text-xs text-slate-500">
                Please check your DATABASE_URL environment variable and table schema.
              </p>
            </div>
          ) : todoList.length > 0 ? (
            <ul className="divide-y divide-slate-800/40">
              {todoList.map((todo) => (
                <li key={todo.id} className="flex items-center gap-3 py-3.5 text-slate-200">
                   <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm font-light leading-relaxed">{todo.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-8 space-y-2">
              <p className="text-slate-400 text-sm">No todos returned from database.</p>
              <p className="text-xs text-slate-600">Make sure you have migrated the `todos` table using Drizzle.</p>
            </div>
          )}
        </div>

        <div className="text-center text-[10px] text-slate-500 font-mono pt-4 border-t border-slate-800/40">
          Connected using Drizzle ORM
        </div>
      </div>
    </div>
  );
}
