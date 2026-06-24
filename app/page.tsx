import { AikoChat } from "@/components/AikoChat";

export const metadata = {
  title: "Aiko | Reflect Beyond Grades",
  description: "A private, interactive space to explore who you are, discover your inner strengths, and reflect on your path.",
};

export default function Page() {
  return (
    <main className="flex-1 flex flex-col min-h-screen min-h-[100dvh] bg-slate-950">
      <AikoChat />
    </main>
  );
}
