import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import { assessRisk, CRISIS_REPLY_GUIDANCE } from "@/lib/safety";

// This route streams from the model, so it must run per-request (never cached).
export const dynamic = "force-dynamic";

// Workhorse model. Override with ANTHROPIC_MODEL (e.g. claude-opus-4-8) if you
// want higher nuance at higher cost.
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

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
    (("role" in m && ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant"))) &&
    "content" in m &&
    typeof (m as ChatMessage).content === "string"
  );
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "Server is not configured. Set ANTHROPIC_API_KEY." },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

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

  // Run the safety check on the latest user message.
  const lastUserMessage = messages[messages.length - 1].content;
  const risk = assessRisk(lastUserMessage);

  // Build the system prompt, layering in crisis guidance when warranted.
  const system =
    risk.level === "crisis"
      ? `${SYSTEM_PROMPT}\n\n# ACTIVE SAFETY CONTEXT\n${CRISIS_REPLY_GUIDANCE}`
      : SYSTEM_PROMPT;

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const modelStream = client.messages.stream({
          model: MODEL,
          max_tokens: 1024,
          system,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });

        modelStream.on("text", (delta) => {
          controller.enqueue(encoder.encode(delta));
        });

        await modelStream.finalMessage();
        controller.close();
      } catch (err) {
        // Stream has likely started, so we can't change the status code —
        // surface a gentle fallback in-band instead.
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
      // Lets the client surface crisis resources immediately, in parallel with
      // the model's streamed reply.
      "X-Risk-Level": risk.level,
    },
  });
}
