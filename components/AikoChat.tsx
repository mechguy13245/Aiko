"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Sparkles, Mic } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { AgeBand, isAgeBand } from "@/lib/aiko/conversation";

const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ");

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ConvProgress {
  turnCount: number;
  dimensionsTouched: number; // out of 5
}

const TypingIndicator = () => (
  <div className="flex items-center gap-1.5 px-4 py-3">
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        className="w-2 h-2 bg-amber-400/60 rounded-full"
        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
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

// Five dots — one per profile dimension. Filled as the conversation touches each.
const DimensionDots: React.FC<{ touched: number }> = ({ touched }) => (
  <div className="flex items-center gap-1" title={`${touched} of 5 areas explored`}>
    {Array.from({ length: 5 }, (_, i) => (
      <div
        key={i}
        className={`w-1.5 h-1.5 rounded-full transition-all ${
          i < touched ? "bg-amber-400/80" : "bg-slate-700"
        }`}
      />
    ))}
  </div>
);

const AgePickerCard: React.FC<{
  ageRange: string;
  isSaved?: boolean;
  disabled?: boolean;
  onClick: () => void;
}> = ({ ageRange, isSaved, disabled, onClick }) => (
  <motion.button
    whileHover={disabled ? undefined : { scale: 1.03, y: -4 }}
    whileTap={disabled ? undefined : { scale: 0.98 }}
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "bg-slate-800/40 hover:bg-slate-800/60 border rounded-2xl p-8 transition-all cursor-pointer relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed",
      isSaved
        ? "border-amber-400/80 shadow-[0_0_15px_rgba(251,191,36,0.15)]"
        : "border-slate-700/50 hover:border-amber-400/30",
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

export const AikoChat = () => {
  const [screen, setScreen] = useState<"landing" | "chat">("landing");
  const [selectedAge, setSelectedAge] = useState<AgeBand | "">("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [errorText, setErrorText] = useState("");
  const [convProgress, setConvProgress] = useState<ConvProgress | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<unknown>(null);
  const stableTranscriptRef = useRef("");
  const speechSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const [savedAge, setSavedAge] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const loadSessionRanRef = useRef(false);

  useEffect(() => {
    if (loadSessionRanRef.current) return;
    loadSessionRanRef.current = true;

    async function loadSession() {
      try {
        const res = await fetch("/api/chat-session");
        if (res.ok) {
          const data = await res.json();
          const existing = data.session;
          if (existing && isAgeBand(existing.ageBand)) {
            setSavedAge(existing.ageBand);
            setSelectedAge(existing.ageBand);
            const transcript = (existing.transcript ?? []) as {
              role: "user" | "assistant";
              content: string;
            }[];
            setConvProgress({
              turnCount: existing.turnCount ?? 0,
              dimensionsTouched: existing.dimensionsTouched ?? 0,
            });
            setMessages(
              transcript.map((m, i) => ({ id: `resumed-${i}`, role: m.role, content: m.content })),
            );
            setScreen("chat");
          }
        }
      } catch (err) {
        console.error("Failed to load session:", err);
      } finally {
        setLoadingProfile(false);
      }
    }
    loadSession();
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [userInput]);

  const sendToAiko = async (ageBand: AgeBand, history: Message[]) => {
    setIsStreaming(true);
    setErrorText("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ageBand,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      setConvProgress({
        turnCount: Number(res.headers.get("X-Aiko-Turn-Count") ?? "0"),
        dimensionsTouched: Number(res.headers.get("X-Aiko-Dimensions-Touched") ?? "0"),
      });

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
          prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m)),
        );
      }
    } catch (err) {
      console.error("Aiko chat request failed:", err);
      setErrorText("Aiko couldn't respond just now. Please try sending that again.");
    } finally {
      setIsStreaming(false);
    }
  };

  const openingFiredRef = useRef(false);

  useEffect(() => {
    if (screen === "chat" && selectedAge && messages.length === 0) {
      if (openingFiredRef.current) return;
      openingFiredRef.current = true;
      sendToAiko(selectedAge, []);
    }
  }, [screen, selectedAge, messages.length]);

  const startConversation = async (age: string) => {
    if (!isAgeBand(age)) return;
    setSelectedAge(age);
    setMessages([]);
    setScreen("chat");
    openingFiredRef.current = false;

    try {
      await fetch("/api/class-range", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classRange: age }),
      });
    } catch (err) {
      console.error("Failed to save class range:", err);
    }
  };

  const handleSend = async () => {
    const text = userInput.trim();
    if (!text || isStreaming || !selectedAge) return;

    if (isListening && recognitionRef.current) {
      (recognitionRef.current as { stop: () => void }).stop();
      setIsListening(false);
    }

    setUserInput("");
    const userMessage: Message = { id: `user-${Date.now()}`, role: "user", content: text };
    const history = [...messages, userMessage];
    setMessages(history);

    await sendToAiko(selectedAge, history);
  };

  const toggleVoice = () => {
    if (!speechSupported) return;

    if (isListening) {
      (recognitionRef.current as { stop: () => void } | null)?.stop();
      setIsListening(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    stableTranscriptRef.current = userInput;

    recognition.onresult = (event: {
      resultIndex: number;
      results: { isFinal: boolean; [index: number]: { transcript: string } }[];
    }) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          stableTranscriptRef.current += (stableTranscriptRef.current ? " " : "") + t.trim();
        } else {
          interim = t;
        }
      }
      const display =
        stableTranscriptRef.current +
        (interim ? (stableTranscriptRef.current ? " " : "") + interim : "");
      setUserInput(display);
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  if (loadingProfile) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/30 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center animate-pulse">
          <Sparkles className="w-5 h-5 text-slate-900" />
        </div>
      </div>
    );
  }

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
            <p className="text-slate-500 text-sm uppercase tracking-wider">Choose your class</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <AgePickerCard
                ageRange="Class 3–5"
                isSaved={savedAge === "3-5"}
                disabled={loadingProfile}
                onClick={() => startConversation("3-5")}
              />
              <AgePickerCard
                ageRange="Class 6–8"
                isSaved={savedAge === "6-8"}
                disabled={loadingProfile}
                onClick={() => startConversation("6-8")}
              />
              <AgePickerCard
                ageRange="Class 9–12"
                isSaved={savedAge === "9-12"}
                disabled={loadingProfile}
                onClick={() => startConversation("9-12")}
              />
            </div>
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
            {convProgress !== null && (
              <DimensionDots touched={convProgress.dimensionsTouched} />
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
          {isStreaming &&
            (messages.length === 0 ||
              messages[messages.length - 1]?.content === "" ||
              messages[messages.length - 1]?.role === "user") && (
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
            {speechSupported && (
              <button
                type="button"
                onClick={toggleVoice}
                disabled={isStreaming}
                title={isListening ? "Stop listening" : "Speak your answer"}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 cursor-pointer relative",
                  isListening
                    ? "bg-rose-500 hover:bg-rose-600 text-white"
                    : "bg-slate-700/30 hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed",
                )}
              >
                <AnimatePresence>
                  {isListening && (
                    <motion.span
                      key="ripple"
                      className="absolute inset-0 rounded-full bg-rose-400/40"
                      initial={{ scale: 1, opacity: 0.6 }}
                      animate={{ scale: 1.8, opacity: 0 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "easeOut" }}
                    />
                  )}
                </AnimatePresence>
                <Mic className="w-5 h-5 relative z-10" />
              </button>
            )}
            <button
              onClick={handleSend}
              disabled={!userInput.trim() || isStreaming}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 cursor-pointer",
                userInput.trim() && !isStreaming
                  ? "bg-amber-500 hover:bg-amber-600 text-slate-900"
                  : "bg-slate-700/30 text-slate-600 cursor-not-allowed",
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
