import { NextResponse } from "next/server";

import { buildDigestPayload } from "@/lib/digest-html";
import {
  aeSummaryBulletsToDraftText,
  isLlmConfiguredForAeSummary,
  tryGenerateAeDailySummaryBullets,
} from "@/lib/llm/ae-daily-summary-llm";
import { resolveOwnerId } from "@/lib/request-owner";
import { readAppData } from "@/lib/storage";

export const maxDuration = 120;

/** Generate editable daily stakeholder summary text from current data + settings notes. */
export async function POST() {
  if (!isLlmConfiguredForAeSummary()) {
    return NextResponse.json(
      {
        error:
          "No LLM API key on the server. Set ANTHROPIC_API_KEY (or OPENAI_API_KEY) on the web service.",
      },
      { status: 503 },
    );
  }

  const ownerId = await resolveOwnerId();
  const data = await readAppData(ownerId);

  if (data.accounts.length === 0 && data.transactions.length === 0) {
    return NextResponse.json(
      { error: "Upload a CSV first so there is book data to summarize." },
      { status: 422 },
    );
  }

  const { actions } = buildDigestPayload(data);

  const bullets = await tryGenerateAeDailySummaryBullets(
    data,
    actions,
    data.settings.digestFooterNotes,
  );

  if (!bullets) {
    return NextResponse.json(
      {
        error:
          "Could not generate a summary. Check server logs or try again. Ensure ANTHROPIC_API_KEY (or OPENAI_API_KEY) is valid.",
      },
      { status: 502 },
    );
  }

  const text = aeSummaryBulletsToDraftText(bullets);

  return NextResponse.json({
    ok: true,
    text,
    accountCount: data.accounts.length,
  });
}
