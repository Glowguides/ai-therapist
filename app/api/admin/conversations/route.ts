import {
  listConversations,
  getConversation,
  isStoreEnabled,
} from "@/lib/store";

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const provided = request.headers.get("x-admin-key") ?? "";
  // Constant-ish comparison.
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export async function GET(request: Request) {
  if (!process.env.ADMIN_PASSWORD) {
    return Response.json(
      { error: "Admin is not configured. Set ADMIN_PASSWORD." },
      { status: 503 },
    );
  }
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!isStoreEnabled()) {
    return Response.json(
      { error: "Storage is not configured (set Upstash env vars)." },
      { status: 503 },
    );
  }

  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const convo = await getConversation(id);
    if (!convo) return Response.json({ error: "Not found." }, { status: 404 });
    return Response.json(convo);
  }

  const conversations = await listConversations(200);
  return Response.json({ conversations });
}
