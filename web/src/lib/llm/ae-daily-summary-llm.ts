import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { z } from "zod";

import { BUSINESS_LLM_CONTEXT } from "@/lib/business-llm-context";
import type { ActionItem, AppData } from "@/lib/types";

import {
  buildBusinessLlmUserPayload,
  isAnthropicConfiguredForDigest,
  isOpenAiConfiguredForDigest,
} from "@/lib/llm/digest-summary-llm";

const responseSchema = z.object({
  bullets: z.array(z.string()).length(5),
});

const AE_SYSTEM = `You draft the end-of-day account update a business operator sends to a stakeholder or teammate.

Hard rules:
- You may ONLY assert facts supported by the JSON payload (export + auto action flags + optional "saved_additional_context").
- If the export does not show something, say so and tell the sender to add it — NEVER invent people, deals, or statuses.
- Align with daily-email themes when data allows: completed work, pending/in-progress items, stakeholder action items, escalations/routing (only if evidenced).
- Exactly 5 bullets. Each bullet is ONE string in the JSON array.
- Each string MUST start with a short markdown-bold title, then the body. Use this pattern: **Title:** remainder of bullet (title 2–6 words, professional).
- Reply with a single JSON object only, no markdown fences: {"bullets":["**Title:** ...","**Title:** ...",...]}

${BUSINESS_LLM_CONTEXT}`;

function buildAeInstructionPayload(
  data: AppData,
  actions: ActionItem[],
  settingsNotes: string | null | undefined,
) {
  const base = buildBusinessLlmUserPayload(data, actions, settingsNotes);
  return {
    ...base,
    instruction:
      'Reply with JSON only: {"bullets":["**Title:** first bullet…","**Title:** second…","**Title:** third…","**Title:** fourth…","**Title:** fifth…"]} — exactly 5 strings, each beginning with **Bold title:**',
  };
}

function parseAeBulletsJson(raw: string): string[] | null {
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

  const bullets = checked.data.bullets.map((b) => b.trim()).filter(Boolean);
  return bullets.length === 5 ? bullets : null;
}

async function tryAnthropicAeSummary(
  data: AppData,
  actions: ActionItem[],
  settingsNotes: string | null | undefined,
): Promise<string[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY!.trim();
  const model =
    process.env.ANTHROPIC_MODEL?.trim() || "claude-3-5-haiku-20241022";

  const client = new Anthropic({ apiKey });
  const payload = buildAeInstructionPayload(data, actions, settingsNotes);
  const userText = `${payload.instruction}\n\nDATA_JSON:\n${JSON.stringify(payload)}`;

  let raw: string;
  try {
    const msg = await client.messages.create({
      model,
      max_tokens: 2048,
      temperature: 0.25,
      system: AE_SYSTEM,
      messages: [{ role: "user", content: userText }],
    });
    const block = msg.content.find((b) => b.type === "text");
    raw = block && block.type === "text" ? block.text : "";
  } catch {
    return null;
  }

  return parseAeBulletsJson(raw);
}

async function tryOpenAiAeSummary(
  data: AppData,
  actions: ActionItem[],
  settingsNotes: string | null | undefined,
): Promise<string[] | null> {
  const apiKey = process.env.OPENAI_API_KEY!.trim();
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  const client = new OpenAI({ apiKey });
  const payload = buildAeInstructionPayload(data, actions, settingsNotes);

  let raw: string;
  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.25,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: AE_SYSTEM },
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

  return parseAeBulletsJson(raw);
}

/**
 * ~5 bullets with **bold** titles for stakeholder update email body (plain text / markdown).
 * Prefers Anthropic when configured, else OpenAI.
 */
export async function tryGenerateAeDailySummaryBullets(
  data: AppData,
  actions: ActionItem[],
  settingsNotes: string | null | undefined,
): Promise<string[] | null> {
  if (isAnthropicConfiguredForDigest()) {
    const bullets = await tryAnthropicAeSummary(data, actions, settingsNotes);
    if (bullets) return bullets;
  }
  if (isOpenAiConfiguredForDigest()) {
    return tryOpenAiAeSummary(data, actions, settingsNotes);
  }
  return null;
}

export function aeSummaryBulletsToDraftText(bullets: string[]): string {
  return bullets.join("\n\n");
}

export function isLlmConfiguredForAeSummary(): boolean {
  return isAnthropicConfiguredForDigest() || isOpenAiConfiguredForDigest();
}
