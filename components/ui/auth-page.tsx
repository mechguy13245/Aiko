"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "./button";
import { createClient } from "@/utils/supabase/client";

import {
  AtSign,
  ChevronLeft,
  Grid2x2Plus,
  Sparkles,
} from "lucide-react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

export function AuthPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  const handleOAuthLogin = async (provider: "google" | "github" | "apple") => {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setMessage(`OAuth Sign In failed: ${err.message}`);
      setMessageType("error");
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setMessage("");
    setMessageType("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setMessage(`Error: ${error.message}`);
        setMessageType("error");
      } else {
        setMessage("Success! Check your email inbox for the magic link.");
        setMessageType("success");
      }
    } catch (err: any) {
      setMessage(`Error: ${err.message || "An unexpected error occurred."}`);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 lg:grid lg:grid-cols-2 overflow-hidden">
      {/* Decorative blurred background blobs */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative hidden h-full flex-col border-r border-slate-800/40 p-10 lg:flex z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/10">
            <Sparkles className="w-4.5 h-4.5 text-slate-900" />
          </div>
          <p className="text-xl font-light text-slate-100 tracking-wide">Aiko</p>
        </div>
        <div className="mt-auto max-w-md">
          <blockquote className="space-y-4">
            <p className="text-2xl font-light text-slate-200 leading-relaxed">
              &ldquo;Aiko has helped me explore who I am beyond grades, giving me a private space to reflect on what truly matters.&rdquo;
            </p>
            <footer className="font-mono text-xs font-semibold text-amber-400/80 uppercase tracking-widest">
              ~ Aiko Explorer
            </footer>
          </blockquote>
        </div>
        <div className="absolute inset-0 -z-10">
          <FloatingPaths position={1} />
          <FloatingPaths position={-1} />
        </div>
      </div>
      <div className="relative flex min-h-screen flex-col justify-center p-6 z-10">
        <div className="mx-auto w-full sm:max-w-[400px] bg-slate-900/50 border border-slate-700/30 backdrop-blur-md rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/10">
              <Sparkles className="w-4.5 h-4.5 text-slate-900" />
            </div>
            <p className="text-xl font-light text-slate-100 tracking-wide">Aiko</p>
          </div>
          <div className="flex flex-col space-y-2">
            <h1 className="text-3xl font-light text-slate-100 tracking-tight">
              Sign In or Join Now!
            </h1>
            <p className="text-slate-400 text-sm">
              Log in or create your Aiko account.
            </p>
          </div>
          <div className="space-y-3">
            <Button
              type="button"
              size="lg"
              className="w-full cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700/50 rounded-xl transition-all hover:scale-[1.01]"
              onClick={() => handleOAuthLogin("google")}
            >
              <GoogleIcon className="size-4 me-2" />
              Continue with Google
            </Button>
            <Button
              type="button"
              size="lg"
              className="w-full cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700/50 rounded-xl transition-all hover:scale-[1.01]"
              onClick={() => handleOAuthLogin("apple")}
            >
              <AppleIcon className="size-4 me-2" />
              Continue with Apple
            </Button>
            <Button
              type="button"
              size="lg"
              className="w-full cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700/50 rounded-xl transition-all hover:scale-[1.01]"
              onClick={() => handleOAuthLogin("github")}
            >
              <GithubIcon className="size-4 me-2" />
              Continue with GitHub
            </Button>
          </div>

          <AuthSeparator />

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <p className="text-slate-400 text-xs">
              Enter your email address to sign in or create an account
            </p>
            <div className="relative h-max">
              <Input
                placeholder="your.email@example.com"
                className="peer ps-9 bg-slate-950/40 border-slate-800 focus:border-amber-400/50 text-slate-200 placeholder:text-slate-650 rounded-xl"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
              <div className="text-slate-500 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
                <AtSign className="size-4" aria-hidden="true" />
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={loading} 
              className="w-full cursor-pointer bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-medium rounded-xl transition-all hover:scale-[1.01]"
            >
              <span>{loading ? "Sending link..." : "Continue With Email"}</span>
            </Button>
          </form>

          {message && (
            <div
              className={cn(
                "p-3 rounded-xl text-xs text-center border",
                messageType === "success"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/20"
              )}
            >
              {message}
            </div>
          )}

          <p className="text-slate-500 text-xs leading-relaxed pt-2">
            By clicking continue, you agree to our{" "}
            <a
              href="#"
              className="hover:text-amber-400 text-slate-400 underline underline-offset-4"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="#"
              className="hover:text-amber-400 text-slate-400 underline underline-offset-4"
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}

function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
      380 - i * 5 * position
    } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
      152 - i * 5 * position
    } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
      684 - i * 5 * position
    } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    color: `rgba(15,23,42,${0.1 + i * 0.03})`,
    width: 0.5 + i * 0.03,
  }));

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg
        className="h-full w-full text-slate-950 dark:text-white"
        viewBox="0 0 696 316"
        fill="none"
      >
        <title>Background Paths</title>
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke="currentColor"
            strokeWidth={path.width}
            strokeOpacity={0.1 + path.id * 0.03}
            initial={{ pathLength: 0.3, opacity: 0.6 }}
            animate={{
              pathLength: 1,
              opacity: [0.3, 0.6, 0.3],
              pathOffset: [0, 1, 0],
            }}
            transition={{
              duration: 20 + Math.random() * 10,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          />
        ))}
      </svg>
    </div>
  );
}

const GoogleIcon = (props: React.ComponentProps<"svg">) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <g>
      <path d="M12.479,14.265v-3.279h11.049c0.108,0.571,0.164,1.247,0.164,1.979c0,2.46-0.672,5.502-2.84,7.669   C18.744,22.829,16.051,24,12.483,24C5.869,24,0.308,18.613,0.308,12S5.869,0,12.483,0c3.659,0,6.265,1.436,8.223,3.307L18.392,5.62   c-1.404-1.317-3.307-2.341-5.913-2.341C7.65,3.279,3.873,7.171,3.873,12s3.777,8.721,8.606,8.721c3.132,0,4.916-1.258,6.059-2.401   c0.927-0.927,1.537-2.251,1.777-4.059L12.479,14.265z" />
    </g>
  </svg>
);

const AppleIcon = (props: React.ComponentProps<"svg">) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.22.67-2.94 1.5-.62.71-1.16 1.85-1.01 2.96 1.12.09 2.27-.58 2.96-1.4z" />
  </svg>
);

const GithubIcon = (props: React.ComponentProps<"svg">) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

const AuthSeparator = () => {
  return (
    <div className="flex w-full items-center justify-center my-2">
      <div className="bg-slate-800 h-px w-full" />
      <span className="text-slate-500 px-2 text-[10px] uppercase font-mono tracking-wider">OR</span>
      <div className="bg-slate-800 h-px w-full" />
    </div>
  );
};
