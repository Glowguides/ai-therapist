"use client";

import { useState } from "react";

interface Summary {
  id: string;
  updatedAt: number;
  messageCount: number;
  riskLevel: string;
  preview: string;
}
interface Message {
  role: "user" | "assistant";
  content: string;
}
interface Conversation {
  id: string;
  createdAt: number;
  updatedAt: number;
  riskLevel: string;
  messages: Message[];
}

function fmt(ts: number) {
  return new Date(ts).toLocaleString();
}

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<Summary[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);

  async function login() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/conversations", {
        headers: { "x-admin-key": key },
      });
      if (res.status === 401) {
        setError("Wrong password.");
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Error (${res.status})`);
        return;
      }
      const data = await res.json();
      setList(data.conversations ?? []);
      setAuthed(true);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  async function open(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/conversations?id=${encodeURIComponent(id)}`, {
        headers: { "x-admin-key": key },
      });
      if (res.ok) setActive(await res.json());
    } finally {
      setLoading(false);
    }
  }

  if (!authed) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6">
        <h1 className="text-lg font-semibold">Admin · conversations</h1>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && login()}
          placeholder="Admin password"
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-teal-300/50"
        />
        <button
          onClick={login}
          disabled={loading || !key}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {loading ? "Checking…" : "Enter"}
        </button>
        {error && <p className="text-sm text-rose-400">{error}</p>}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">
          Conversations <span className="text-white/40">({list.length})</span>
        </h1>
        {active && (
          <button onClick={() => setActive(null)} className="text-sm text-teal-300 underline">
            ← back to list
          </button>
        )}
      </div>

      {!active ? (
        <ul className="space-y-2">
          {list.length === 0 && <li className="text-sm text-white/50">No conversations yet.</li>}
          {list.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => open(c.id)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/10"
              >
                <div className="flex items-center justify-between text-xs text-white/50">
                  <span>{fmt(c.updatedAt)}</span>
                  <span>
                    {c.messageCount} msgs
                    {c.riskLevel !== "none" && (
                      <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-300">
                        {c.riskLevel}
                      </span>
                    )}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-white/80">{c.preview || "—"}</p>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-white/40">
            {fmt(active.createdAt)} · risk: {active.riskLevel} · id {active.id.slice(0, 8)}…
          </div>
          {active.messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-teal-700/80 px-4 py-2 text-sm"
                    : "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-white/10 bg-white/5 px-4 py-2 text-sm"
                }
              >
                <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-white/40">
                  {m.role}
                </span>
                {m.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
