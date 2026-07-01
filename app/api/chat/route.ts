import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import { assessRisk, CRISIS_REPLY_GUIDANCE } from "@/lib/safety";
import { saveConversation } from "@/lib/store";

// This route streams from the model, so it must run per-request (never cached).
export const dynamic = "force-dynamic";

// Google Gemini (free tier). Override with GEMINI_MODEL if desired.
const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

// Cap history so a long conversation can't blow up cost / latency unbounded.
const MAX_HISTORY_MESSAGES = 40;

type Role = "user" | "assistant";
interface ChatMessage {
  role: Role;
  content: string;
}

function isValidMessage(m: unknown): m is ChatMessage {
  return (
    typeof m === "object" &&
    m !== null &&
    "role" in m &&
    ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") &&
    "content" in m &&
    typeof (m as ChatMessage).content === "string"
  );
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Server is not configured. Set GEMINI_API_KEY." },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const rawSessionId = (body as { sessionId?: unknown })?.sessionId;
  const sessionId =
    typeof rawSessionId === "string" && rawSessionId.length > 0
      ? rawSessionId.slice(0, 100)
      : crypto.randomUUID();

  const rawMessages = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(rawMessages) || !rawMessages.every(isValidMessage)) {
    return Response.json(
      { error: "Body must be { messages: { role, content }[] }." },
      { status: 400 },
    );
  }

  const messages = (rawMessages as ChatMessage[])
    .filter((m) => m.content.trim().length > 0)
    .slice(-MAX_HISTORY_MESSAGES);

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return Response.json(
      { error: "Conversation must end with a user message." },
      { status: 400 },
    );
  }

  // Safety check on the latest user message.
  const lastUserMessage = messages[messages.length - 1].content;
  const risk = assessRisk(lastUserMessage);

  const systemText =
    risk.level === "crisis"
      ? `${SYSTEM_PROMPT}\n\n# ACTIVE SAFETY CONTEXT\n${CRISIS_REPLY_GUIDANCE}`
      : SYSTEM_PROMPT;

  // Gemini uses role "model" for the assistant.
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const upstream = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemText }] },
            contents,
            generationConfig: {
              maxOutputTokens: 1024,
              temperature: 0.95,
              // Disable "thinking" so the short output budget goes to the
              // actual reply (and replies stay snappy in a chat).
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const detail = await upstream.text().catch(() => "");
          console.error("gemini error:", upstream.status, detail.slice(0, 500));
          controller.enqueue(
            encoder.encode(
              "\n\n(Sorry — I'm having trouble responding right now. If this is urgent, please reach out to a crisis line or local emergency services.)",
            ),
          );
          controller.close();
          return;
        }

        // Parse the SSE stream and forward text deltas.
        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let assistantText = "";

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
                    assistantText += p.text;
                    controller.enqueue(encoder.encode(p.text));
                  }
                }
              }
            } catch {
              // Ignore partial / non-JSON keepalive lines.
            }
          }
        }

        // Persist the full transcript for this session (if storage is set up).
        if (assistantText.length > 0) {
          await saveConversation(
            sessionId,
            [...messages, { role: "assistant", content: assistantText }],
            risk.level,
          );
        }
        controller.close();
      } catch (err) {
        console.error("chat stream error:", err);
        controller.enqueue(
          encoder.encode(
            "\n\n(Sorry — I'm having trouble responding right now. If this is urgent, please reach out to a crisis line or local emergency services.)",
          ),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Risk-Level": risk.level,
    },
  });
}
