# A space to talk — AI supportive companion

A calm, web-based AI companion for emotional support and reflection, built with Next.js and the Anthropic API.

> ⚠️ **Important:** This is a *supportive companion*, not a licensed therapist, and not a substitute for professional mental-health care. It is designed with safety guardrails (crisis detection, resource surfacing, scope boundaries), but anyone building on it for real users must take the responsibilities in [Safety & ethics](#safety--ethics) seriously.

## What's here

- **Streaming chat** (`app/api/chat/route.ts`) — talks to Claude with server-side streaming.
- **Therapeutic persona** (`lib/system-prompt.ts`) — warm, reflective, evidence-informed (active/reflective listening, MI, light CBT framing); explicitly non-clinical.
- **Safety layer** (`lib/safety.ts`) — heuristic risk detection (suicidal ideation, self-harm, harm to others, abuse) that surfaces real crisis resources and steers the model, independent of the model's own output.
- **Calm UI** (`app/page.tsx`) — focused chat with persistent disclaimer and a crisis-resource banner.

## Getting started

1. Install dependencies (already done if you scaffolded this):
   ```bash
   npm install
   ```
2. Add your Anthropic API key to `.env.local`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
   Get one at https://console.anthropic.com/.
3. Run the dev server:
   ```bash
   npm run dev
   ```
4. Open http://localhost:3000.

The default model is `claude-sonnet-4-6` (good balance of quality and cost for long conversations). Override with `ANTHROPIC_MODEL` — e.g. `claude-opus-4-8` for higher nuance.

## Safety & ethics

The crisis layer here is a **starting point**, not a finished safety system. Before putting this in front of real users:

- **Don't market it as therapy.** It cannot diagnose or treat, and saying it can is an ethical and legal problem in most jurisdictions.
- **Strengthen risk detection.** The keyword heuristic in `lib/safety.ts` has false positives and negatives. Pair it with a trained classifier; never weaken the resource-surfacing behavior.
- **Localize crisis resources** to each user's region (the defaults are international/generic).
- **Privacy.** These are highly sensitive conversations. Add encryption at rest, minimal retention, a real privacy policy, and consider regulatory exposure (HIPAA/GDPR) before storing anything.
- **Add auth, rate limiting, and abuse handling** before exposing the API publicly.

## Roadmap (production hardening)

- [ ] Authentication and per-user sessions
- [ ] Encrypted, minimal-retention conversation storage (or none)
- [ ] Rate limiting and abuse protection on `/api/chat`
- [ ] Classifier-backed risk detection + human escalation path
- [ ] Region-aware crisis resources
- [ ] Privacy policy, terms, and clear onboarding consent
