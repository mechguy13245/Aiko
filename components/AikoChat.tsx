"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowUp, Sparkles } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import {
  AgeBand,
  getActCount,
  isAgeBand,
  isClosingTurn,
} from "@/lib/aiko/conversation";

// Utility function
const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ");

// Types
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// Components
const TypingIndicator = () => (
  <div className="flex items-center gap-1.5 px-4 py-3">
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        className="w-2 h-2 bg-amber-400/60 rounded-full"
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 1.2,
          repeat: Infinity,
          delay: i * 0.2,
        }}
      />
    ))}
  </div>
);

const ChatBubble: React.FC<{ message: Message }> = ({ message }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className={`flex ${message.role === "assistant" ? "justify-start" : "justify-end"} mb-4`}
  >
    <div
      className={`max-w-[80%] px-4 py-3 rounded-2xl ${
        message.role === "assistant"
          ? "bg-slate-800/50 text-slate-100 rounded-tl-sm"
          : "bg-violet-600/20 text-slate-100 rounded-tr-sm"
      }`}
    >
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
    </div>
  </motion.div>
);

const ProgressIndicator: React.FC<{ current: number; total: number }> = ({ current, total }) => (
  <div className="text-xs text-slate-400 font-mono">
    Act {current} of {total}
  </div>
);

const AgePickerCard: React.FC<{ ageRange: string; isSaved?: boolean; disabled?: boolean; onClick: () => void }> = ({ ageRange, isSaved, disabled, onClick }) => (
  <motion.button
    whileHover={disabled ? undefined : { scale: 1.03, y: -4 }}
    whileTap={disabled ? undefined : { scale: 0.98 }}
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "bg-slate-800/40 hover:bg-slate-800/60 border rounded-2xl p-8 transition-all cursor-pointer relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed",
      isSaved ? "border-amber-400/80 shadow-[0_0_15px_rgba(251,191,36,0.15)]" : "border-slate-700/50 hover:border-amber-400/30"
    )}
  >
    {isSaved && (
      <div className="absolute top-2 right-2 bg-amber-400/20 text-amber-300 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-400/30 font-mono">
        Saved
      </div>
    )}
    <div className="text-2xl font-light text-slate-100">{ageRange}</div>
  </motion.button>
);

// Main Component
export const AikoChat = () => {
  const [screen, setScreen] = useState<"landing" | "chat" | "reflection">("landing");
  const [selectedAge, setSelectedAge] = useState<AgeBand | "">("");
  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [closingText, setClosingText] = useState("");
  const [errorText, setErrorText] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [savedAge, setSavedAge] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/class-range");
        if (res.ok) {
          const data = await res.json();
          if (data.classRange) {
            setSavedAge(data.classRange);
          }
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setLoadingProfile(false);
      }
    }
    loadProfile();
  }, []);

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/auth";
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  const userTurnCount = messages.filter((m) => m.role === "user").length;
  const actCount = selectedAge ? getActCount(selectedAge) : 0;
  const currentActDisplay = Math.min(userTurnCount + 1, actCount);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [userInput]);

  const sendToAiko = async (ageBand: AgeBand, sid: string, history: Message[]) => {
    setIsStreaming(true);
    setErrorText("");

    const nextUserTurnCount = history.filter((m) => m.role === "user").length;
    const willClose = isClosingTurn(ageBand, nextUserTurnCount);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ageBand,
          sessionId: sid,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      if (willClose) {
        const text = await res.text();
        setClosingText(text);
        setIsStreaming(false);
        setTimeout(() => setScreen("reflection"), 600);
        return;
      }

      const assistantId = `aiko-${Date.now()}`;
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m))
        );
      }
    } catch (err) {
      console.error("Aiko chat request failed:", err);
      setErrorText("Aiko couldn't respond just now. Please try sending that again.");
    } finally {
      setIsStreaming(false);
    }
  };

  const startConversation = async (age: string) => {
    if (!isAgeBand(age)) return;
    const sid = crypto.randomUUID();
    setSelectedAge(age);
    setSessionId(sid);
    setMessages([]);
    setScreen("chat");

    try {
      await fetch("/api/class-range", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classRange: age }),
      });
    } catch (err) {
      console.error("Failed to save class range:", err);
    }

    await sendToAiko(age, sid, []);
  };

  const handleSend = async () => {
    const text = userInput.trim();
    if (!text || isStreaming || !selectedAge) return;

    setUserInput("");
    const userMessage: Message = { id: `user-${Date.now()}`, role: "user", content: text };
    const history = [...messages, userMessage];
    setMessages(history);

    await sendToAiko(selectedAge, sessionId, history);
  };

  if (screen === "landing") {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
        <button
          onClick={handleSignOut}
          className="absolute top-6 right-6 text-xs px-3.5 py-1.5 bg-slate-900/60 hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-800/85 rounded-xl transition-all cursor-pointer z-20"
        >
          Sign Out
        </button>
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/30 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-2xl w-full text-center space-y-12">
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 mb-4"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-slate-900" />
              </div>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl font-light text-slate-100 tracking-tight"
            >
              Aiko
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-slate-400 text-lg"
            >
              A space to explore who you are, beyond grades
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            <p className="text-slate-500 text-sm uppercase tracking-wider">Choose your age</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <AgePickerCard ageRange="5–8" isSaved={savedAge === "5-8"} disabled={loadingProfile} onClick={() => startConversation("5-8")} />
              <AgePickerCard ageRange="9–12" isSaved={savedAge === "9-12"} disabled={loadingProfile} onClick={() => startConversation("9-12")} />
              <AgePickerCard ageRange="13–18" isSaved={savedAge === "13-18"} disabled={loadingProfile} onClick={() => startConversation("13-18")} />
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (screen === "reflection") {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/30 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-2xl w-full space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-4"
          >
            <h2 className="text-3xl font-light text-slate-100">Here&apos;s what I noticed</h2>
            <p className="text-slate-400">These are just reflections, not judgments</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-6"
          >
            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{closingText}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-center space-y-6 pt-8"
          >
            <p className="text-slate-400 text-sm">
              Come back anytime to keep exploring who you are
            </p>
            <button
              onClick={() => {
                setScreen("landing");
                setMessages([]);
                setSelectedAge("");
                setClosingText("");
              }}
              className="px-6 py-3 bg-slate-800/40 hover:bg-slate-800/60 border border-slate-700/50 rounded-xl text-slate-200 transition-colors cursor-pointer"
            >
              Start over
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-slate-800/50 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-slate-900" />
            </div>
            <div>
              <h1 className="text-slate-100 font-light">Aiko</h1>
              <p className="text-xs text-slate-500">listening</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {actCount > 0 && (
              <ProgressIndicator current={currentActDisplay} total={actCount} />
            )}
            <button
              onClick={handleSignOut}
              className="text-xs px-3.5 py-1.5 bg-slate-900/60 hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-800/80 rounded-xl transition-all cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto relative z-10">
        <div className="max-w-2xl mx-auto px-6 py-8">
          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}
          {isStreaming && messages[messages.length - 1]?.content === "" && (
            <div className="flex justify-start mb-4">
              <div className="bg-slate-800/50 rounded-2xl rounded-tl-sm">
                <TypingIndicator />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      <div className="relative z-10 border-t border-slate-800/50 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-6 py-4 space-y-3">
          {errorText && <p className="text-xs text-rose-400">{errorText}</p>}
          <div className="flex items-end gap-3 bg-slate-800/30 border border-slate-700/30 rounded-2xl p-3">
            <textarea
              ref={textareaRef}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type your answer..."
              disabled={isStreaming}
              className="flex-1 bg-transparent text-slate-100 placeholder:text-slate-500 text-base resize-none outline-none min-h-[44px] max-h-[120px] disabled:opacity-60"
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!userInput.trim() || isStreaming}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 cursor-pointer",
                userInput.trim() && !isStreaming
                  ? "bg-amber-500 hover:bg-amber-600 text-slate-900"
                  : "bg-slate-700/30 text-slate-600 cursor-not-allowed"
              )}
            >
              <ArrowUp className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
