"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowUp, Sparkles } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

// Utility function
const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ");

// Types
interface Message {
  id: string;
  text: string;
  isAiko: boolean;
  timestamp: Date;
}

interface Question {
  id: string;
  text: string;
  choices: string[];
}

interface Insight {
  label: string;
  observation: string;
}

interface ConversationData {
  questions: Question[];
  insights: Insight[];
}

// Mock conversation data
const conversationsByAge: Record<string, ConversationData> = {
  "5-8": {
    questions: [
      {
        id: "q1",
        text: "What do you love to do when you have free time?",
        choices: ["Play outside", "Draw or paint", "Read stories", "Build things"],
      },
      {
        id: "q2",
        text: "What makes you feel really happy?",
        choices: ["Being with friends", "Learning new things", "Helping others", "Creating something"],
      },
      {
        id: "q3",
        text: "What's something you're really good at?",
        choices: ["Making people laugh", "Solving puzzles", "Being kind", "Imagining stories"],
      },
      {
        id: "q4",
        text: "When something is hard, what do you do?",
        choices: ["Keep trying", "Ask for help", "Take a break", "Try a different way"],
      },
      {
        id: "q5",
        text: "What do you wonder about the most?",
        choices: ["How things work", "What others feel", "New places", "What I can create"],
      },
    ],
    insights: [
      { label: "Your curiosity", observation: "You ask questions and love discovering new things." },
      { label: "Your kindness", observation: "You care about how others feel and want to help." },
      { label: "Your creativity", observation: "You see the world in your own special way." },
    ],
  },
  "9-12": {
    questions: [
      {
        id: "q1",
        text: "What do you do when nobody's watching?",
        choices: ["Read or learn", "Create something", "Help someone", "Explore ideas"],
      },
      {
        id: "q2",
        text: "What's something you're good at that people don't know about?",
        choices: ["Understanding others", "Solving problems", "Making things", "Thinking deeply"],
      },
      {
        id: "q3",
        text: "When you face a challenge, what's your first instinct?",
        choices: ["Figure it out myself", "Talk it through", "Research it", "Try different approaches"],
      },
      {
        id: "q4",
        text: "What kind of impact do you want to have?",
        choices: ["Help people feel better", "Create something useful", "Share knowledge", "Make things fair"],
      },
      {
        id: "q5",
        text: "What questions keep you up at night?",
        choices: ["How can I improve?", "What's really true?", "How do things connect?", "What's my purpose?"],
      },
    ],
    insights: [
      { label: "Your depth", observation: "You think about things in ways others might miss." },
      { label: "Your empathy", observation: "You notice how people feel and respond with care." },
      { label: "Your drive", observation: "You want to understand yourself and grow." },
    ],
  },
  "13-18": {
    questions: [
      {
        id: "q1",
        text: "What do you do when nobody's watching?",
        choices: ["Pursue a passion", "Help others quietly", "Learn something new", "Create or build"],
      },
      {
        id: "q2",
        text: "What's a strength of yours that doesn't show up on a report card?",
        choices: ["Emotional intelligence", "Creative thinking", "Resilience", "Authentic connection"],
      },
      {
        id: "q3",
        text: "When you're struggling, what helps you most?",
        choices: ["Time to reflect", "Talking it out", "Taking action", "Changing perspective"],
      },
      {
        id: "q4",
        text: "What kind of person do you want to become?",
        choices: ["Someone who understands", "Someone who creates", "Someone who leads", "Someone who cares"],
      },
      {
        id: "q5",
        text: "What matters to you that others might not understand?",
        choices: ["Inner growth", "Authentic expression", "Making a difference", "Finding truth"],
      },
      {
        id: "q6",
        text: "How do you know when you're being true to yourself?",
        choices: ["I feel at peace", "I feel energized", "I feel connected", "I feel purposeful"],
      },
    ],
    insights: [
      { label: "Your authenticity", observation: "You're learning to honor who you really are." },
      { label: "Your awareness", observation: "You notice patterns in yourself and the world around you." },
      { label: "Your courage", observation: "You're willing to explore difficult questions about life and identity." },
    ],
  },
};

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
    className={`flex ${message.isAiko ? "justify-start" : "justify-end"} mb-4`}
  >
    <div
      className={`max-w-[80%] px-4 py-3 rounded-2xl ${
        message.isAiko
          ? "bg-slate-800/50 text-slate-100 rounded-tl-sm"
          : "bg-violet-600/20 text-slate-100 rounded-tr-sm"
      }`}
    >
      <p className="text-sm leading-relaxed">{message.text}</p>
    </div>
  </motion.div>
);

const ChoiceChip: React.FC<{ text: string; onClick: () => void }> = ({ text, onClick }) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className="px-4 py-2.5 bg-slate-800/40 hover:bg-slate-700/50 border border-slate-700/50 rounded-xl text-sm text-slate-200 transition-colors cursor-pointer"
  >
    {text}
  </motion.button>
);

const ProgressIndicator: React.FC<{ current: number; total: number }> = ({ current, total }) => (
  <div className="text-xs text-slate-400 font-mono">
    Question {current} of {total}
  </div>
);

const InsightCard: React.FC<{ insight: Insight }> = ({ insight }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-6"
  >
    <h3 className="text-amber-400 font-medium mb-2">{insight.label}</h3>
    <p className="text-slate-300 text-sm leading-relaxed">{insight.observation}</p>
  </motion.div>
);

const AgePickerCard: React.FC<{ ageRange: string; isSaved?: boolean; onClick: () => void }> = ({ ageRange, isSaved, onClick }) => (
  <motion.button
    whileHover={{ scale: 1.03, y: -4 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={cn(
      "bg-slate-800/40 hover:bg-slate-800/60 border rounded-2xl p-8 transition-all cursor-pointer relative overflow-hidden",
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
  const [selectedAge, setSelectedAge] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [showChoices, setShowChoices] = useState(false);
  const [userInput, setUserInput] = useState("");
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

  const conversationData = selectedAge ? conversationsByAge[selectedAge] : null;
  const currentQuestion = conversationData?.questions[currentQuestionIndex];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [userInput]);

  const startConversation = async (age: string) => {
    setSelectedAge(age);
    setScreen("chat");

    try {
      await fetch("/api/class-range", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ classRange: age }),
      });
    } catch (err) {
      console.error("Failed to save class range:", err);
    }

    setTimeout(() => {
      askQuestion(0, age);
    }, 800);
  };

  const askQuestion = (index: number, age: string) => {
    const ageData = conversationsByAge[age];
    if (!ageData) return;
    
    setIsTyping(true);
    setTimeout(() => {
      const question = ageData.questions[index];
      if (!question) {
        setIsTyping(false);
        return;
      }
      const aikoMessage: Message = {
        id: `aiko-${Date.now()}`,
        text: question.text,
        isAiko: true,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aikoMessage]);
      setIsTyping(false);
      setShowChoices(true);
    }, 1500);
  };

  const handleChoice = (choice: string) => {
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text: choice,
      isAiko: false,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setShowChoices(false);
    setUserInput("");

    const questionsLength = conversationData?.questions.length || 0;
    if (currentQuestionIndex < questionsLength - 1) {
      setTimeout(() => {
        setCurrentQuestionIndex((prev) => prev + 1);
        askQuestion(currentQuestionIndex + 1, selectedAge);
      }, 1000);
    } else {
      setTimeout(() => {
        setScreen("reflection");
      }, 1500);
    }
  };

  const handleTextSubmit = () => {
    if (!userInput.trim()) return;
    handleChoice(userInput);
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
              <AgePickerCard ageRange="5–8" isSaved={savedAge === "5-8"} onClick={() => startConversation("5-8")} />
              <AgePickerCard ageRange="9–12" isSaved={savedAge === "9-12"} onClick={() => startConversation("9-12")} />
              <AgePickerCard ageRange="13–18" isSaved={savedAge === "13-18"} onClick={() => startConversation("13-18")} />
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
            <h2 className="text-3xl font-light text-slate-100">Here's what I noticed</h2>
            <p className="text-slate-400">These are just reflections, not judgments</p>
          </motion.div>

          <div className="space-y-4">
            {conversationData?.insights.map((insight, index) => (
              <motion.div key={index} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.2 }}>
                <InsightCard insight={insight} />
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-center space-y-6 pt-8"
          >
            <p className="text-slate-400 text-sm">
              Come back anytime to keep exploring who you are
            </p>
            <button
              onClick={() => {
                setScreen("landing");
                setMessages([]);
                setCurrentQuestionIndex(0);
                setSelectedAge("");
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
            {conversationData && (
              <ProgressIndicator
                current={currentQuestionIndex + 1}
                total={conversationData.questions.length}
              />
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
          {isTyping && (
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
        <div className="max-w-2xl mx-auto px-6 py-4 space-y-4">
          {showChoices && currentQuestion && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap gap-2"
            >
              {currentQuestion.choices.map((choice, index) => (
                <ChoiceChip key={index} text={choice} onClick={() => handleChoice(choice)} />
              ))}
            </motion.div>
          )}

          <div className="flex items-end gap-3 bg-slate-800/30 border border-slate-700/30 rounded-2xl p-3">
            <textarea
              ref={textareaRef}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleTextSubmit();
                }
              }}
              placeholder="Or type your own answer..."
              className="flex-1 bg-transparent text-slate-100 placeholder:text-slate-500 text-base resize-none outline-none min-h-[44px] max-h-[120px]"
              rows={1}
            />
            <button
              onClick={handleTextSubmit}
              disabled={!userInput.trim()}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 cursor-pointer",
                userInput.trim()
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
