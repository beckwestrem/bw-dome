import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { z } from "zod";

import { BUSINESS_LLM_CONTEXT } from "@/lib/business-llm-context";
import type { Account, ActionItem, AppData } from "@/lib/types";

const responseSchema = z.object({
  bullets: z.array(z.string()).length(5),
});

const META_KEYS = [
  "deal_stage",
  "completion_status",
  "stage_summary",
  "ticket_status",
  "ticket_task",
  "service_stage",
  "active_tickets",
  "pending_orders",
  "completed_items",
] as const;

function trimMeta(account: Account): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of META_KEYS) {
    const v = account.metadata?.[k]?.trim();
    if (v) {
      out[k] = v.length > 500 ? `${v.slice(0, 500)}…` : v;
    }
  }
  return out;
}

/** Shared export + actions JSON for LLM prompts (digest + stakeholder summary). */
export function buildBusinessLlmUserPayload(
  data: AppData,
  actions: ActionItem[],
  settingsNotes: string | null | undefined,
) {
  const primaryCurrency = data.accounts[0]?.currency ?? "USD";
  const bookTotal = data.accounts.reduce((s, a) => s + a.balance, 0);

  const accounts = data.accounts.slice(0, 50).map((a) => ({
    name: a.name,
    type: a.type,
    balance: a.balance,
    currency: a.currency,
    metadata: trimMeta(a),
  }));

  const autoActions = actions.slice(0, 25).map((x) => ({
    priority: x.priority,
    title: x.title.slice(0, 200),
    why: x.why.slice(0, 400),
    nextStep: x.nextStep.slice(0, 300),
  }));

  return {
    instruction:
      'Use ONLY this JSON to write 5 bullets. Reply with a single JSON object only, no markdown: {"bullets": ["...","...","...","...","..."]}',
    book: {
      accountCount: data.accounts.length,
      transactionCount: data.transactions.length,
      primaryCurrency,
      bookTotal,
    },
    accounts,
    auto_actions: autoActions,
    am_saved_additional_context: settingsNotes?.trim() || null,
  };
}

/** LLM bullets for the scheduled / test digest — reader is the operator, not a stakeholder. */
const DIGEST_LLM_SYSTEM = `You write exactly 5 bullet points for the business operator who is READING this email themselves.

This is their personal business digest for triage and awareness — not a message to forward to a teammate or stakeholder. Do not write as if briefing someone else. Prefer second person ("your book," "for you to review," "worth your attention") or neutral operational phrasing.

Hard rules:
- You may ONLY assert facts that are supported by the JSON payload (export summary + auto-generated action flags + optional "saved_additional_context").
- If something is not evidenced in the data (e.g. whether work was completed, exact owner, timeline), say clearly that the export does not show it and they can add it in their saved notes — NEVER invent or guess.
- Do not name people, deals, or statuses that are not in the payload.
- Themes when the data allows: what the export suggests about completed vs in-progress work, what deserves their attention, task/ticket load, escalation-related wording in fields, book snapshot — framed as their own working view, not a handoff.
- Each bullet: one or two short sentences, plain English, professional.
- Always return exactly 5 strings in the bullets array inside valid JSON only.

${BUSINESS_LLM_CONTEXT}`;

const DIGEST_LLM_INSTRUCTION =
  'Use ONLY this JSON. Audience: the business operator reading this digest for themselves. Reply with a single JSON object only, no markdown: {"bullets": ["...","...","...","...","..."]}';

function parseBulletsJson(raw: string): string[] | null {
  const trimmed = raw.trim();
  const jsonSlice =
    trimmed.startsWith("{")
      ? trimmed
      : trimmed.includes("{")
        ? trimmed.slice(trimmed.indexOf("{"), trimmed.lastIndexOf("}") + 1)
        : trimmed;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonSlice);
  } catch {
    return null;
  }

  const checked = responseSchema.safeParse(parsed);
  if (!checked.success) {
    return null;
  }

  return checked.data.bullets.map((b) => b.trim()).filter(Boolean).length === 5
    ? checked.data.bullets.map((b) => b.trim())
    : null;
}

export function isAnthropicConfiguredForDigest(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function isOpenAiConfiguredForDigest(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/** True if any LLM provider is configured for digest bullets. */
export function isLlmConfiguredForDigest(): boolean {
  return isAnthropicConfiguredForDigest() || isOpenAiConfiguredForDigest();
}

async function tryAnthropicDigestBullets(
  data: AppData,
  actions: ActionItem[],
  settingsNotes: string | null | undefined,
): Promise<string[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY!.trim();
  const model =
    process.env.ANTHROPIC_MODEL?.trim() || "claude-3-5-haiku-20241022";

  const client = new Anthropic({ apiKey });
  const base = buildBusinessLlmUserPayload(data, actions, settingsNotes);
  const payload = { ...base, instruction: DIGEST_LLM_INSTRUCTION };
  const userText = `${payload.instruction}\n\nDATA_JSON:\n${JSON.stringify(payload)}`;

  let raw: string;
  try {
    const msg = await client.messages.create({
      model,
      max_tokens: 2048,
      temperature: 0.25,
      system: DIGEST_LLM_SYSTEM,
      messages: [{ role: "user", content: userText }],
    });
    const block = msg.content.find((b) => b.type === "text");
    raw = block && block.type === "text" ? block.text : "";
  } catch {
    return null;
  }

  return parseBulletsJson(raw);
}

async function tryOpenAiDigestBullets(
  data: AppData,
  actions: ActionItem[],
  settingsNotes: string | null | undefined,
): Promise<string[] | null> {
  const apiKey = process.env.OPENAI_API_KEY!.trim();
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  const client = new OpenAI({ apiKey });
  const base = buildBusinessLlmUserPayload(data, actions, settingsNotes);
  const payload = { ...base, instruction: DIGEST_LLM_INSTRUCTION };

  let raw: string;
  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.25,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: DIGEST_LLM_SYSTEM },
        {
          role: "user",
          content: `${payload.instruction}\n\nDATA_JSON:\n${JSON.stringify(payload)}`,
        },
      ],
    });
    raw = completion.choices[0]?.message?.content ?? "";
  } catch {
    return null;
  }

  return parseBulletsJson(raw);
}

/**
 * Returns LLM bullets or null (caller should use rule-based bullets).
 * Prefers Anthropic when ANTHROPIC_API_KEY is set, else OpenAI when OPENAI_API_KEY is set.
 */
export async function tryGenerateDigestBulletsWithLlm(
  data: AppData,
  actions: ActionItem[],
  settingsNotes: string | null | undefined,
): Promise<string[] | null> {
  if (isAnthropicConfiguredForDigest()) {
    const bullets = await tryAnthropicDigestBullets(data, actions, settingsNotes);
    if (bullets) return bullets;
  }
  if (isOpenAiConfiguredForDigest()) {
    return tryOpenAiDigestBullets(data, actions, settingsNotes);
  }
  return null;
}
