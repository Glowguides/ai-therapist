/**
 * Browser-side Gemini streaming — used by the static GitHub Pages build, where
 * there is no server. Google's Generative Language API allows CORS calls with
 * an API key, so the page can stream directly from the browser.
 *
 * NOTE: this path embeds a NEXT_PUBLIC_ key in the client bundle, so it's only
 * appropriate for a free-tier key that's been restricted to the site's domain.
 * The server route (app/api/chat) remains the secret-safe path for real
 * deployments.
 */
import { SYSTEM_PROMPT } from "./system-prompt";
import { assessRisk, CRISIS_REPLY_GUIDANCE } from "./safety";

const MODEL = process.env.NEXT_PUBLIC_GEMINI_MODEL || "gemini-2.5-flash";

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export async function* streamGemini(
  messages: ChatMsg[],
  apiKey: string,
): AsyncGenerator<string> {
  const last = messages[messages.length - 1]?.content ?? "";
  const risk = assessRisk(last);
  const system =
    risk.level === "crisis"
      ? `${SYSTEM_PROMPT}\n\n# ACTIVE SAFETY CONTEXT\n${CRISIS_REPLY_GUIDANCE}`
      : SYSTEM_PROMPT;

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.95,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Gemini request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const json = JSON.parse(data);
        const parts = json?.candidates?.[0]?.content?.parts;
        if (Array.isArray(parts)) {
          for (const p of parts) {
            if (typeof p?.text === "string" && p.text.length > 0) {
              yield p.text;
            }
          }
        }
      } catch {
        // Ignore partial / keepalive lines.
      }
    }
  }
}
