"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  Mic,
  Volume2,
  VolumeX,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Download,
  BookOpen,
  X,
  LogOut,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { jsPDF } from "jspdf";

const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(" ");

interface Message {
  id: string;
  text: string;
  isUser: boolean;
}

interface ComicPanel {
  id: string;
  imageUrl: string;
  caption: string;
}

// Shape as stored in DB (from memoryStore)
interface StoredPanel {
  narration: string;
  imageUrl: string;
  userInput: string;
}

interface PastStory {
  id: string;
  panels: StoredPanel[];
  createdAt: string;
}

// Sketchy animated border
const SketchbookBorder = ({ isVisible }: { isVisible: boolean }) => {
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);

  useEffect(() => {
    if (pathRef.current) setPathLength(pathRef.current.getTotalLength());
  }, []);

  return (
    <svg
      className="absolute inset-0 h-full w-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="sketch-wobble">
          <feTurbulence baseFrequency="0.02" numOctaves="2" seed={42} result="turbulence" />
          <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="1.5" />
        </filter>
      </defs>
      <motion.path
        ref={pathRef}
        d="M2,2 L98,2 L98,98 L2,98 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
        className="text-amber-700/40"
        style={{ filter: "url(#sketch-wobble)" }}
        initial={{ strokeDasharray: pathLength, strokeDashoffset: pathLength }}
        animate={{ strokeDashoffset: isVisible ? 0 : pathLength }}
        transition={{ duration: 2, ease: "easeInOut" }}
      />
    </svg>
  );
};

// Animated cartoon character
const CartoonCharacter = ({ isSpeaking }: { isSpeaking: boolean }) => (
  <motion.div
    className="relative w-40 h-40 md:w-56 md:h-56"
    animate={{ scale: isSpeaking ? [1, 1.05, 1] : 1 }}
    transition={{ duration: 0.5, repeat: isSpeaking ? Infinity : 0 }}
  >
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Head */}
      <motion.circle
        cx="100" cy="80" r="50"
        fill="#FFD93D" stroke="#2D3436" strokeWidth="3"
        animate={{ scale: isSpeaking ? [1, 1.02, 1] : 1 }}
      />
      {/* Eyes */}
      <circle cx="85" cy="75" r="8" fill="#2D3436" />
      <circle cx="115" cy="75" r="8" fill="#2D3436" />
      <circle cx="87" cy="73" r="3" fill="white" />
      <circle cx="117" cy="73" r="3" fill="white" />
      {/* Mouth */}
      <motion.path
        d={isSpeaking ? "M 80 95 Q 100 108 120 95" : "M 85 95 Q 100 100 115 95"}
        fill="none" stroke="#2D3436" strokeWidth="3" strokeLinecap="round"
      />
      {/* Body */}
      <rect x="75" y="130" width="50" height="60" rx="10" fill="#6C5CE7" stroke="#2D3436" strokeWidth="3" />
      {/* Arms */}
      <motion.line
        x1="75" y1="145" x2="50" y2="160"
        stroke="#2D3436" strokeWidth="3" strokeLinecap="round"
        animate={{ rotate: isSpeaking ? [0, -10, 0] : 0 }}
        style={{ originX: "75px", originY: "145px" }}
      />
      <motion.line
        x1="125" y1="145" x2="150" y2="160"
        stroke="#2D3436" strokeWidth="3" strokeLinecap="round"
        animate={{ rotate: isSpeaking ? [0, 10, 0] : 0 }}
        style={{ originX: "125px", originY: "145px" }}
      />
    </svg>

    <AnimatePresence>
      {isSpeaking && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0 }}
          className="absolute -right-4 top-8 flex gap-1"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 bg-amber-500 rounded-full"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  </motion.div>
);

// Mic button with pulse rings
const MicButton = ({
  isRecording,
  isProcessing,
  size = "lg",
  onClick,
}: {
  isRecording: boolean;
  isProcessing: boolean;
  size?: "lg" | "sm";
  onClick: () => void;
}) => {
  const dim = size === "lg" ? "h-24 w-24" : "h-20 w-20";
  const iconSize = size === "lg" ? "w-10 h-10" : "w-8 h-8";

  return (
    <div className="relative flex flex-col items-center gap-2">
      <div className="relative">
        <AnimatePresence>
          {isRecording && (
            <>
              <motion.div
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 2, opacity: 0 }}
                exit={{ scale: 1, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                className="absolute inset-0 bg-red-500 rounded-full z-0"
              />
              <motion.div
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 1.5, opacity: 0 }}
                exit={{ scale: 1, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
                className="absolute inset-0 bg-red-500 rounded-full z-0"
              />
            </>
          )}
        </AnimatePresence>
        <button
          onClick={onClick}
          disabled={isProcessing}
          className={cn(
            "rounded-full shadow-xl transition-all duration-200 relative z-10 flex items-center justify-center",
            dim,
            isRecording
              ? "bg-red-500 scale-110"
              : "bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {isRecording ? (
            <div className="flex gap-1 h-3 items-end">
              {[0, 1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  className="w-1 bg-white rounded-full"
                  animate={{ height: [4, 12, 4] }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
                />
              ))}
            </div>
          ) : (
            <Mic className={cn(iconSize, "text-white")} />
          )}
        </button>
      </div>
      <p className="text-sm font-handwriting text-amber-900/70">
        {isProcessing ? "Creating panel..." : isRecording ? "Listening..." : "Tap to Speak"}
      </p>
    </div>
  );
};

export const ComicCreator = () => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut().catch(console.error);
    window.location.href = "/auth";
  };
  const [showSketchbook, setShowSketchbook] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [comicPanels, setComicPanels] = useState<ComicPanel[]>([]);
  const [currentPanelIndex, setCurrentPanelIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isAikoSpeaking, setIsAikoSpeaking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const [showPastStories, setShowPastStories] = useState(false);
  const [pastStories, setPastStories] = useState<PastStory[]>([]);
  const [viewingStory, setViewingStory] = useState<PastStory | null>(null);
  const [loadingStories, setLoadingStories] = useState(false);
  const [viewingPanelIndex, setViewingPanelIndex] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleViewPastStories = async () => {
    setLoadingStories(true);
    setShowPastStories(true);
    try {
      const res = await fetch("/api/comic/stories");
      if (res.ok) {
        const data = await res.json();
        setPastStories(data.stories ?? []);
      }
    } catch (err) {
      console.error("Failed to load past stories:", err);
    } finally {
      setLoadingStories(false);
    }
  };

  // Auto-advance carousel
  useEffect(() => {
    if (showSketchbook && comicPanels.length > 1) {
      const timer = setInterval(() => {
        setCurrentPanelIndex((prev) => (prev + 1) % comicPanels.length);
      }, 4000);
      return () => clearInterval(timer);
    }
  }, [showSketchbook, comicPanels.length]);

  const handleStartChat = async () => {
    try {
      setIsProcessing(true);
      const res = await fetch("/api/comic/session/new", { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to start session");

      setSessionId(data.sessionId);
      const openingText = "Hi! I'm so excited to hear your story! What's it about? 🌟";
      setMessages([{ id: "intro", text: openingText, isUser: false }]);

      // Play hardcoded opening audio — instant, no TTS API call needed
      if (!isMuted) {
        const audio = new Audio("/opening-audio.wav");
        setIsAikoSpeaking(true);
        audio.onended = () => setIsAikoSpeaking(false);
        audio.onerror = () => setIsAikoSpeaking(false);
        audio.play().catch(() => setIsAikoSpeaking(false));
      }
    } catch (error) {
      console.error("Failed to start comic session:", error);
      setErrorMessage("Couldn't start the session. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current);
        await handleSendAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      setErrorMessage("Couldn't access microphone. Please allow microphone access.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }
  };

  const handleSendAudio = async (audioBlob: Blob) => {
    if (!sessionId) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);

      await new Promise<void>((resolve, reject) => {
        reader.onloadend = async () => {
          try {
            const base64Audio = (reader.result as string).split(",")[1];
            if (!base64Audio) throw new Error("Empty audio");

            const res = await fetch("/api/comic/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sessionId,
                audioBase64: base64Audio,
              }),
            });

            const data = await res.json();

            if (data.error === "AUDIO_TOO_SHORT") {
              setErrorMessage("I couldn't hear you clearly. Please try again!");
              resolve();
              return;
            }

            if (data.error === "Session not found or expired") {
              setErrorMessage("Session expired. Please start a new story.");
              setSessionId(null);
              resolve();
              return;
            }

            if (data.response) {
              setMessages((prev) => [
                ...prev,
                { id: `bot-${Date.now()}`, text: data.response, isUser: false },
              ]);
            }

            // Play TTS audio
            if (data.audioBase64 && !isMuted) {
              try {
                const mimeType = data.audioMimeType || "audio/mpeg";
                const audio = new Audio(`data:${mimeType};base64,${data.audioBase64}`);
                setIsAikoSpeaking(true);
                audio.onended = () => setIsAikoSpeaking(false);
                audio.onerror = () => setIsAikoSpeaking(false);
                audio.play();
              } catch {
                console.error("Audio playback failed");
              }
            }

            if (data.imageUrl) {
              const newPanel: ComicPanel = {
                id: `panel-${Date.now()}`,
                imageUrl: data.imageUrl,
                caption: data.theme || data.response || "",
              };
              setComicPanels((prev) => {
                const updated = [...prev, newPanel];
                if (updated.length === 1) {
                  setShowSketchbook(true);
                  setCurrentPanelIndex(0);
                } else {
                  setCurrentPanelIndex(updated.length - 1);
                }
                return updated;
              });
            }

            if (data.isDone) setIsDone(true);
            resolve();
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = reject;
      });
    } catch (err) {
      console.error("Send audio failed:", err);
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNewStory = async () => {
    if (sessionId) {
      await fetch("/api/comic/session/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
    }
    setShowSketchbook(false);
    setMessages([]);
    setComicPanels([]);
    setCurrentPanelIndex(0);
    setSessionId(null);
    setIsDone(false);
    setIsListening(false);
    setErrorMessage(null);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();

    comicPanels.forEach((panel, index) => {
      if (index > 0) doc.addPage();

      if (index === 0) {
        doc.setFontSize(24);
        doc.text("My Story Comic", 105, 20, { align: "center" });
      }

      if (panel.imageUrl && !panel.imageUrl.startsWith("https://placehold")) {
        try {
          doc.addImage(panel.imageUrl, "JPEG", 15, index === 0 ? 40 : 20, 180, 135);
        } catch {
          // skip image if it fails to embed
        }
      }

      doc.setFontSize(14);
      const splitText = doc.splitTextToSize(panel.caption || "", 170);
      doc.text(splitText, 105, index === 0 ? 190 : 170, { align: "center" });

      doc.setTextColor(200, 200, 200);
      doc.setFontSize(40);
      doc.text("StoryTime", 105, 280, { align: "center", angle: 45 });
      doc.setTextColor(0, 0, 0);
    });

    doc.save("my-story-comic.pdf");
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap');
        .font-handwriting { font-family: 'Caveat', cursive; }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white/60 hover:bg-white/90 text-amber-800/60 hover:text-amber-900 border border-amber-900/15 rounded-xl transition-all"
          title="Sign out"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
        <button
          onClick={() => setIsMuted((m) => !m)}
          className="text-amber-800/50 hover:text-amber-900 transition-colors"
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {!showSketchbook ? (
          // ── HERO / CHAT SCREEN ──
          <motion.section
            key="hero"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-[calc(100vh-56px)] w-full flex flex-col items-center justify-center px-6 py-8"
          >
            <div className="w-full max-w-md">
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-center mb-6"
              >
                <h1 className="text-5xl font-bold text-amber-900 font-handwriting">Story Time!</h1>
                <p className="text-lg text-amber-700/70 font-handwriting mt-1">
                  Create your own comic adventure
                </p>
              </motion.div>

              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="relative bg-white/80 backdrop-blur-sm border-4 border-amber-900/20 shadow-2xl rounded-3xl p-8"
              >
                <SketchbookBorder isVisible />

                <div className="relative flex flex-col items-center gap-6">
                  <CartoonCharacter isSpeaking={isAikoSpeaking || isListening} />

                  <div className="flex flex-col items-center gap-4 w-full relative">
                    {/* Error bubble */}
                    <AnimatePresence>
                      {errorMessage && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.9 }}
                          className="absolute -top-20 left-1/2 -translate-x-1/2 whitespace-nowrap bg-red-50 text-red-600 px-4 py-2 rounded-full border-2 border-red-200 shadow-lg font-handwriting text-lg z-10"
                        >
                          {errorMessage}
                          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-50 border-b-2 border-r-2 border-red-200 rotate-45" />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {!sessionId ? (
                      <div className="flex flex-col items-center gap-3 w-full">
                        <button
                          onClick={handleStartChat}
                          disabled={isProcessing}
                          className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-full px-8 font-handwriting text-xl h-16 shadow-lg flex items-center gap-2 transition-colors"
                        >
                          <Mic className="w-6 h-6" />
                          {isProcessing ? "Starting..." : "Start Chat"}
                        </button>
                        <button
                          onClick={handleViewPastStories}
                          className="flex items-center gap-2 text-amber-700 hover:text-amber-900 font-handwriting text-lg transition-colors"
                        >
                          <BookOpen className="w-4 h-4" />
                          My Past Stories
                        </button>
                      </div>
                    ) : (
                      <MicButton
                        isRecording={isRecording}
                        isProcessing={isProcessing}
                        size="lg"
                        onClick={isRecording ? stopRecording : startRecording}
                      />
                    )}

                    {/* Last message from character */}
                    {messages.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full text-center mt-2"
                      >
                        <div className="bg-amber-100/70 rounded-xl p-3 border border-amber-200">
                          <p className="text-xl font-handwriting text-amber-900/80">
                            {messages[messages.length - 1].isUser
                              ? "..."
                              : messages[messages.length - 1].text}
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {comicPanels.length > 0 && (
                      <button
                        onClick={() => setShowSketchbook(true)}
                        className="w-full mt-2 rounded-full font-handwriting text-lg shadow-sm bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 h-12 flex items-center justify-center gap-2 transition-colors"
                      >
                        <Sparkles className="w-4 h-4" />
                        View Sketchbook ({comicPanels.length})
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.section>
        ) : (
          // ── SKETCHBOOK / COMIC VIEW ──
          <motion.section
            key="sketchbook"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-[calc(100vh-56px)] w-full flex items-center justify-center p-6 py-8"
          >
            <div className="w-full max-w-md flex flex-col gap-5">
              {/* Header */}
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="flex items-center justify-between"
              >
                <h2 className="text-3xl font-bold text-amber-900 font-handwriting">
                  {isDone ? "🎉 Your Comic!" : "Your Story Comic"}
                </h2>
                <div className="bg-amber-100 px-4 py-2 rounded-full border-2 border-amber-300">
                  <span className="text-lg font-handwriting text-amber-900">
                    {currentPanelIndex + 1} / {comicPanels.length}
                  </span>
                </div>
              </motion.div>

              {/* Carousel */}
              <div className="relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentPanelIndex}
                    initial={{ opacity: 0, x: 100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ duration: 0.35 }}
                  >
                    <div className="relative w-full bg-amber-50 rounded-3xl border-4 border-amber-900/30 shadow-2xl overflow-hidden">
                      <SketchbookBorder isVisible />
                      <div className="relative p-5 flex flex-col items-center">
                        <div className="w-full aspect-[4/3] bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden">
                          {comicPanels[currentPanelIndex]?.imageUrl ? (
                            <img
                              src={comicPanels[currentPanelIndex].imageUrl}
                              alt={comicPanels[currentPanelIndex].caption}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Sparkles className="w-20 h-20 text-amber-600" />
                          )}
                        </div>
                        <p className="mt-5 text-2xl font-handwriting text-center text-amber-900/90">
                          {comicPanels[currentPanelIndex]?.caption}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>

                <button
                  onClick={() => setCurrentPanelIndex((p) => Math.max(0, p - 1))}
                  disabled={currentPanelIndex === 0}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full h-10 w-10 bg-white/90 hover:bg-white shadow-md flex items-center justify-center disabled:opacity-30 transition-opacity"
                >
                  <ChevronLeft className="w-5 h-5 text-amber-900" />
                </button>
                <button
                  onClick={() => setCurrentPanelIndex((p) => Math.min(comicPanels.length - 1, p + 1))}
                  disabled={currentPanelIndex === comicPanels.length - 1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full h-10 w-10 bg-white/90 hover:bg-white shadow-md flex items-center justify-center disabled:opacity-30 transition-opacity"
                >
                  <ChevronRight className="w-5 h-5 text-amber-900" />
                </button>
              </div>

              {/* Actions */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="flex flex-col gap-3"
              >
                {!isDone && (
                  <div className="flex justify-center">
                    <MicButton
                      isRecording={isRecording}
                      isProcessing={isProcessing}
                      size="sm"
                      onClick={isRecording ? stopRecording : startRecording}
                    />
                  </div>
                )}

                <button
                  onClick={handleExportPDF}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-full font-handwriting text-xl h-14 shadow-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <Download className="w-5 h-5" /> Export PDF
                </button>
                <button
                  onClick={handleNewStory}
                  className="w-full border-2 border-amber-300 hover:border-amber-400 bg-white hover:bg-amber-50 text-amber-900 rounded-full font-handwriting text-xl h-14 flex items-center justify-center gap-2 transition-colors"
                >
                  <RotateCcw className="w-5 h-5" /> New Story
                </button>
              </motion.div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ── PAST STORIES OVERLAY ── */}
      <AnimatePresence>
        {showPastStories && !viewingStory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-amber-50/95 backdrop-blur-sm overflow-y-auto"
          >
            <div className="max-w-md mx-auto px-4 py-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-4xl font-bold text-amber-900 font-handwriting">My Stories</h2>
                <button onClick={() => setShowPastStories(false)} className="text-amber-700 hover:text-amber-900">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {loadingStories ? (
                <div className="flex items-center justify-center py-20">
                  <motion.div
                    className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                </div>
              ) : pastStories.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-2xl font-handwriting text-amber-700">No stories yet!</p>
                  <p className="text-lg font-handwriting text-amber-500 mt-2">Create your first comic adventure.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {pastStories.map((story) => {
                    const firstPanel = story.panels[0];
                    const date = new Date(story.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
                    return (
                      <motion.button
                        key={story.id}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => { setViewingStory(story); setViewingPanelIndex(0); }}
                        className="bg-white rounded-2xl border-2 border-amber-200 shadow-md overflow-hidden text-left"
                      >
                        <div className="aspect-[4/3] bg-amber-100 flex items-center justify-center overflow-hidden">
                          {firstPanel?.imageUrl ? (
                            <img src={firstPanel.imageUrl} alt="Story thumbnail" className="w-full h-full object-cover" />
                          ) : (
                            <Sparkles className="w-8 h-8 text-amber-300" />
                          )}
                        </div>
                        <div className="p-2">
                          <p className="font-handwriting text-amber-900 text-sm font-bold">{story.panels.length} panels</p>
                          <p className="font-handwriting text-amber-500 text-xs">{date}</p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── STORY DETAIL OVERLAY ── */}
      <AnimatePresence>
        {viewingStory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-amber-50/95 backdrop-blur-sm overflow-y-auto"
          >
            <div className="max-w-md mx-auto px-4 py-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setViewingStory(null)}
                  className="flex items-center gap-1.5 text-amber-700 hover:text-amber-900 font-handwriting text-lg"
                >
                  <ChevronLeft className="w-5 h-5" /> All Stories
                </button>
                <span className="font-handwriting text-amber-700">
                  {viewingPanelIndex + 1} / {viewingStory.panels.length}
                </span>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={viewingPanelIndex}
                  initial={{ opacity: 0, x: 60 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -60 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white rounded-3xl border-4 border-amber-900/20 shadow-xl overflow-hidden"
                >
                  <div className="aspect-[4/3] bg-amber-100 overflow-hidden">
                    {viewingStory.panels[viewingPanelIndex]?.imageUrl ? (
                      <img
                        src={viewingStory.panels[viewingPanelIndex].imageUrl}
                        alt="Comic panel"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Sparkles className="w-12 h-12 text-amber-300" />
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <p className="font-handwriting text-xl text-amber-900 leading-snug">
                      {viewingStory.panels[viewingPanelIndex]?.narration}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setViewingPanelIndex((i) => Math.max(0, i - 1))}
                  disabled={viewingPanelIndex === 0}
                  className="w-12 h-12 rounded-full bg-amber-100 border-2 border-amber-300 flex items-center justify-center disabled:opacity-40"
                >
                  <ChevronLeft className="w-5 h-5 text-amber-900" />
                </button>
                <button
                  onClick={() => setViewingPanelIndex((i) => Math.min(viewingStory.panels.length - 1, i + 1))}
                  disabled={viewingPanelIndex === viewingStory.panels.length - 1}
                  className="w-12 h-12 rounded-full bg-amber-100 border-2 border-amber-300 flex items-center justify-center disabled:opacity-40"
                >
                  <ChevronRight className="w-5 h-5 text-amber-900" />
                </button>
              </div>

              {/* Dot indicators */}
              <div className="flex justify-center gap-2">
                {viewingStory.panels.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setViewingPanelIndex(i)}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all",
                      i === viewingPanelIndex ? "bg-amber-600 w-4" : "bg-amber-300"
                    )}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
