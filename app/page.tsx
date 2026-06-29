"use client";

import { useEffect, useRef, useState } from "react";
import { DISCLAIMER } from "@/lib/system-prompt";
import { CRISIS_RESOURCES, type RiskLevel } from "@/lib/safety";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const GREETING =
  "Hi — I'm here to listen. There's no agenda and nothing you have to get “right.” What's on your mind today?";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("none");
  const scrollRef = useRef<HTMLDivElement>(null);

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

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
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
    <div className="flex flex-col h-dvh max-w-2xl mx-auto w-full">
      <header className="px-5 pt-6 pb-3">
        <h1 className="text-lg font-semibold tracking-tight">A space to talk</h1>
        <p className="text-xs text-stone-500 mt-1 leading-relaxed">{DISCLAIMER}</p>
      </header>

      {riskLevel !== "none" && <CrisisBanner level={riskLevel} />}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.map((m, i) => (
          <Bubble
            key={i}
            role={m.role}
            content={m.content}
            streaming={isStreaming && i === messages.length - 1}
          />
        ))}
      </div>

      <div className="px-5 pb-5 pt-2">
        <div className="flex items-end gap-2 rounded-2xl border border-stone-300/70 bg-white/60 dark:bg-stone-900/40 dark:border-stone-700 p-2 shadow-sm">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Type what's on your mind…"
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-stone-400 max-h-40"
          />
          <button
            onClick={send}
            disabled={isStreaming || !input.trim()}
            className="shrink-0 rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-800 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
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
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-2xl rounded-br-md bg-teal-700 px-4 py-2.5 text-sm text-white whitespace-pre-wrap"
            : "max-w-[85%] rounded-2xl rounded-bl-md bg-stone-100 dark:bg-stone-800 px-4 py-2.5 text-sm text-stone-800 dark:text-stone-100 whitespace-pre-wrap"
        }
      >
        {content || (streaming ? <span className="text-stone-400">…</span> : "")}
      </div>
    </div>
  );
}

function CrisisBanner({ level }: { level: RiskLevel }) {
  return (
    <div className="mx-5 mb-1 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 px-4 py-3">
      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
        {level === "crisis"
          ? "It sounds like you're going through something really hard. You deserve support from a real person right now."
          : "If things feel like too much, you don't have to face it alone."}
      </p>
      <ul className="mt-2 space-y-1.5 text-xs text-amber-900/90 dark:text-amber-200/90">
        {CRISIS_RESOURCES.map((r) => (
          <li key={r.name}>
            <span className="font-semibold">{r.name}:</span> {r.detail}
            {r.href && (
              <>
                {" "}
                <a
                  href={r.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
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
