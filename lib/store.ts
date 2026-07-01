/**
 * Conversation storage (Upstash Redis, serverless-friendly).
 *
 * Privacy by design: we store conversation transcripts keyed by a random
 * session id generated in the browser — NOT IP addresses or any device
 * identifier. Storage is only active when Upstash env vars are present, so the
 * app runs fine without it. Users are told conversations may be stored and
 * reviewed (see the disclaimer in the UI) — that disclosure is what makes the
 * admin view consensual.
 */
import { Redis } from "@upstash/redis";

let client: Redis | null = null;

function getRedis(): Redis | null {
  if (client) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  client = new Redis({ url, token });
  return client;
}

export function isStoreEnabled(): boolean {
  return getRedis() !== null;
}

export interface StoredMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Conversation {
  id: string;
  createdAt: number;
  updatedAt: number;
  riskLevel: string;
  messages: StoredMessage[];
}

export interface ConversationSummary {
  id: string;
  updatedAt: number;
  messageCount: number;
  riskLevel: string;
  preview: string;
}

const INDEX = "convos:index";

/** Upsert the full transcript for a session. Never throws. */
export async function saveConversation(
  id: string,
  messages: StoredMessage[],
  riskLevel: string,
): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    const now = Date.now();
    const key = `convo:${id}`;
    const existing = await r.get<Conversation>(key).catch(() => null);
    const convo: Conversation = {
      id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      riskLevel,
      messages,
    };
    await r.set(key, convo);
    await r.zadd(INDEX, { score: now, member: id });
  } catch (err) {
    console.error("saveConversation failed:", err);
  }
}

/** Most-recent-first summaries for the admin list. */
export async function listConversations(limit = 200): Promise<ConversationSummary[]> {
  const r = getRedis();
  if (!r) return [];
  const ids = (await r.zrange<string[]>(INDEX, 0, limit - 1, { rev: true })) ?? [];
  if (ids.length === 0) return [];
  const keys = ids.map((id) => `convo:${id}`);
  const convos = (await r.mget<Conversation[]>(...keys)) ?? [];
  return convos
    .filter((c): c is Conversation => !!c)
    .map((c) => ({
      id: c.id,
      updatedAt: c.updatedAt,
      messageCount: c.messages.length,
      riskLevel: c.riskLevel,
      preview:
        c.messages.find((m) => m.role === "user")?.content.slice(0, 100) ?? "",
    }));
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const r = getRedis();
  if (!r) return null;
  return (await r.get<Conversation>(`convo:${id}`)) ?? null;
}
