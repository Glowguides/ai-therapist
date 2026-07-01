"use client";

import { useEffect, useRef, useState } from "react";
import { DISCLAIMER } from "@/lib/system-prompt";
import { assessRisk, CRISIS_RESOURCES, type RiskLevel } from "@/lib/safety";
import { streamGemini } from "@/lib/gemini-client";
import SmokeBackground from "./SmokeBackground";

interface Message {
  role: "user" | "assistant";
  content: string;
}

// Static GitHub Pages build (no server). If a public Gemini key is baked in,
// we stream the real model from the browser; otherwise the chat is simulated.
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const PUBLIC_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const SIMULATED = DEMO_MODE && !PUBLIC_KEY;

const DEMO_REPLY =
  "Thanks for sharing that. You're in the UI demo, so I can't give a real, considered response here — this version runs without a backend. In the full app I'd listen and reflect on what you said, at your pace. (Notice the safety check still ran on your message.) To try the real thing, run it locally or deploy it with an API key.";

const GREETING =
  "Hi — I'm here to listen. There's no agenda and nothing you have to get “right.” What's on your mind today?";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("none");
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string>("");

  useEffect(() => {
    // Stable random session id (no IP / device tracking) for grouping a
    // person's conversation across messages.
    let id = localStorage.getItem("sid");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("sid", id);
    }
    sessionIdRef.current = id;
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || isStreaming) return;

    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setIsStreaming(true);

    // Add an empty assistant message we'll stream into.
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    const appendChunk = (chunk: string) =>
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          content: copy[copy.length - 1].content + chunk,
        };
        return copy;
      });

    // Static build (GitHub Pages): no server route to call.
    if (DEMO_MODE) {
      const detected = assessRisk(text).level;
      if (detected !== "none") setRiskLevel(detected);

      if (PUBLIC_KEY) {
        // Real Gemini, streamed directly from the browser.
        try {
          for await (const chunk of streamGemini(next, PUBLIC_KEY)) {
            appendChunk(chunk);
          }
        } catch (err) {
          console.error(err);
          appendChunk(
            "Something went wrong reaching me just now. If this is urgent, please contact a crisis line or local emergency services.",
          );
        }
      } else {
        // No key configured — "type" a canned reply.
        const words = DEMO_REPLY.split(" ");
        for (let i = 0; i < words.length; i++) {
          await sleep(28);
          appendChunk((i === 0 ? "" : " ") + words[i]);
        }
      }
      setIsStreaming(false);
      return;
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, sessionId: sessionIdRef.current }),
      });

      const detected = (res.headers.get("X-Risk-Level") as RiskLevel) ?? "none";
      if (detected !== "none") setRiskLevel(detected);

      if (!res.ok || !res.body) {
        throw new Error(`Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = {
            role: "assistant",
            content: copy[copy.length - 1].content + chunk,
          };
          return copy;
        });
      }
    } catch (err) {
      console.error(err);
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          content:
            "Something went wrong reaching me just now. If this is urgent, please contact a crisis line or local emergency services.",
        };
        return copy;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center p-3 sm:p-6">
      <SmokeBackground />

      <section className="flex h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.05] shadow-[0_24px_80px_-20px_rgba(0,0,0,0.7)] backdrop-blur-md ring-1 ring-white/5">
        <header className="border-b border-white/10 px-6 pb-4 pt-6">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="pulse-soft absolute inline-flex h-full w-full rounded-full bg-teal-300" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal-400" />
            </span>
            <h1 className="bg-gradient-to-r from-teal-100 via-white to-indigo-200 bg-clip-text text-xl font-semibold tracking-tight text-transparent">
              A space to talk
            </h1>
            {SIMULATED && (
              <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/70">
                Demo · simulated
              </span>
            )}
          </div>
          <p className="mt-2 max-w-prose text-xs leading-relaxed text-white/45">
            {DISCLAIMER}
          </p>
        </header>

        {riskLevel !== "none" && <CrisisBanner level={riskLevel} />}

        <div ref={scrollRef} className="scroll-soft flex-1 space-y-4 overflow-y-auto px-5 py-6 sm:px-6">
          {messages.map((m, i) => (
            <Bubble
              key={i}
              role={m.role}
              content={m.content}
              streaming={isStreaming && i === messages.length - 1}
            />
          ))}
        </div>

        <div className="px-4 pb-5 pt-3 sm:px-6">
          <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.06] p-2 shadow-inner backdrop-blur-xl transition focus-within:border-teal-300/40 focus-within:ring-1 focus-within:ring-teal-300/30">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Type what's on your mind…"
              className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2 text-sm text-white/90 outline-none placeholder:text-white/35"
            />
            <button
              onClick={send}
              disabled={isStreaming || !input.trim()}
              aria-label="Send message"
              className="group shrink-0 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 px-4 py-2.5 text-sm font-medium text-emerald-950 shadow-lg shadow-teal-500/20 transition hover:shadow-teal-400/40 disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none"
            >
              <svg
                className="h-4 w-4 transition-transform group-enabled:group-hover:translate-x-0.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-white/25">
            Press Enter to send · Shift+Enter for a new line
          </p>
        </div>
      </section>
    </main>
  );
}

function Bubble({
  role,
  content,
  streaming,
}: {
  role: "user" | "assistant";
  content: string;
  streaming: boolean;
}) {
  const isUser = role === "user";
  const showDots = !content && streaming;

  return (
    <div className={`rise-in flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={
          isUser
            ? "max-w-[82%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-br from-teal-500/90 to-emerald-600/90 px-4 py-2.5 text-sm leading-relaxed text-white shadow-lg shadow-emerald-900/30"
            : "max-w-[82%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.07] px-4 py-2.5 text-sm leading-relaxed text-white/90 backdrop-blur-md"
        }
      >
        {showDots ? (
          <span className="flex gap-1 py-0.5">
            <span className="pulse-soft h-1.5 w-1.5 rounded-full bg-white/60" style={{ animationDelay: "0ms" }} />
            <span className="pulse-soft h-1.5 w-1.5 rounded-full bg-white/60" style={{ animationDelay: "200ms" }} />
            <span className="pulse-soft h-1.5 w-1.5 rounded-full bg-white/60" style={{ animationDelay: "400ms" }} />
          </span>
        ) : (
          content
        )}
      </div>
    </div>
  );
}

function CrisisBanner({ level }: { level: RiskLevel }) {
  return (
    <div className="mx-5 mt-3 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 backdrop-blur-md sm:mx-6">
      <p className="text-sm font-medium text-amber-100">
        {level === "crisis"
          ? "It sounds like you're going through something really hard. You deserve support from a real person right now."
          : "If things feel like too much, you don't have to face it alone."}
      </p>
      <ul className="mt-2 space-y-1.5 text-xs text-amber-100/80">
        {CRISIS_RESOURCES.map((r) => (
          <li key={r.name}>
            <span className="font-semibold text-amber-100">{r.name}:</span> {r.detail}
            {r.href && (
              <>
                {" "}
                <a
                  href={r.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-amber-300/50 underline-offset-2 hover:text-amber-50"
                >
                  {r.href.replace(/^https?:\/\//, "")}
                </a>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
