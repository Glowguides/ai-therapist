/**
 * Safety layer.
 *
 * This is a heuristic, defense-in-depth net — NOT a clinical risk-assessment
 * tool. It scans user text for language suggesting acute risk (suicidal
 * ideation, self-harm, intent to harm others, abuse) so the app can surface
 * real crisis resources immediately, regardless of what the model says.
 *
 * Keyword matching has false positives and false negatives by design: we err
 * toward surfacing help. For a production product this should be paired with a
 * trained classifier, but the resource-surfacing behavior here must never be
 * removed.
 */

export type RiskLevel = "none" | "elevated" | "crisis";

export interface RiskAssessment {
  level: RiskLevel;
  /** Which category(ies) tripped the check — for logging, not for display. */
  categories: string[];
}

/**
 * Patterns that indicate acute crisis (active intent / imminent danger).
 * Word-boundary anchored to limit obvious false positives.
 */
const CRISIS_PATTERNS: { category: string; re: RegExp }[] = [
  {
    category: "suicidal_ideation",
    re: /\b(kill myself|killing myself|end my life|ending my life|take my (own )?life|want to die|wanna die|don'?t want to (be alive|live|exist)|better off dead|suicidal|commit suicide|end it all)\b/i,
  },
  {
    category: "self_harm",
    re: /\b(cut myself|cutting myself|hurt myself|harming myself|self[-\s]?harm)\b/i,
  },
  {
    category: "plan_or_means",
    re: /\b(how (do|can) i (kill|hang|overdose)|overdose on|enough pills to|jump off|my suicide (plan|note))\b/i,
  },
  {
    category: "harm_to_others",
    re: /\b(kill (him|her|them|someone|everyone)|hurt (him|her|them|someone)|want to (kill|murder))\b/i,
  },
];

/**
 * Patterns that indicate elevated distress but not necessarily imminent danger.
 * These warrant a gentle check-in and resources, not a full crisis takeover.
 */
const ELEVATED_PATTERNS: { category: string; re: RegExp }[] = [
  {
    category: "hopelessness",
    re: /\b(no (reason|point) (to|in) (living|going on)|can'?t (go on|do this anymore|take it anymore)|give up on life|nothing matters anymore|hopeless)\b/i,
  },
  {
    category: "abuse",
    re: /\b(being abused|he hits me|she hits me|they hurt me|sexually assaulted|raped me|domestic (abuse|violence))\b/i,
  },
];

export function assessRisk(text: string): RiskAssessment {
  const categories: string[] = [];
  let level: RiskLevel = "none";

  for (const { category, re } of CRISIS_PATTERNS) {
    if (re.test(text)) {
      categories.push(category);
      level = "crisis";
    }
  }

  if (level !== "crisis") {
    for (const { category, re } of ELEVATED_PATTERNS) {
      if (re.test(text)) {
        categories.push(category);
        level = "elevated";
      }
    }
  }

  return { level, categories };
}

export interface CrisisResource {
  name: string;
  detail: string;
  href?: string;
}

/**
 * International / generic crisis resources. No single-country assumption.
 * Localize this list per deployment region for a real product.
 */
export const CRISIS_RESOURCES: CrisisResource[] = [
  {
    name: "Emergency services",
    detail:
      "If you are in immediate danger, call your local emergency number now (e.g. 112 in the EU, 911 in the US, 999 in the UK).",
  },
  {
    name: "Find a Helpline",
    detail:
      "Free, confidential crisis lines in 130+ countries — choose your country for local numbers.",
    href: "https://findahelpline.com",
  },
  {
    name: "988 (US & Canada)",
    detail: "Call or text 988 to reach the Suicide & Crisis Lifeline.",
  },
  {
    name: "International Association for Suicide Prevention",
    detail: "Directory of crisis centres worldwide.",
    href: "https://www.iasp.info/resources/Crisis_Centres/",
  },
];

/**
 * A short message the assistant should lead with when a crisis is detected.
 * Surfaced to the model as guidance and also rendered as a UI banner so the
 * user sees resources even if the model response is delayed or fails.
 */
export const CRISIS_REPLY_GUIDANCE = `The user may be in crisis. Your priorities, in order:
1. Respond with genuine warmth and without judgement. Take what they said seriously.
2. Gently encourage them to reach out to a crisis line or emergency services right now, and make clear they deserve support from a trained human.
3. If they are in immediate danger, urge them to contact local emergency services.
4. Do NOT give methods, do NOT minimize, do NOT lecture, do NOT promise confidentiality you can't keep.
5. Stay present with them. Ask if they are safe right now. Keep your message brief and human.`;
