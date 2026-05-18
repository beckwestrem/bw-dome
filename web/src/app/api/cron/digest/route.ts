import { NextResponse } from "next/server";

import { sendDigestForOwner } from "@/lib/send-digest-for-owner";
import { listDigestSubscribers } from "@/lib/storage";
import { smtpConfigured } from "@/lib/send-digest-smtp";

/** Allow time for OpenAI when digest bullets use the LLM path. */
export const maxDuration = 120;

function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Twice-daily digest for every subscriber with digest on + Postgres.
 * Schedule: POST with Authorization: Bearer $CRON_SECRET
 * Optional: ?dry_run=1 to list recipients without sending (no SMTP required).
 */
export async function POST(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dry_run") === "1";

  if (!smtpConfigured() && !dryRun) {
    return NextResponse.json(
      {
        error:
          "SMTP not configured. Set SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD, DIGEST_SENDER_EMAIL.",
      },
      { status: 503 },
    );
  }

  const rows = await listDigestSubscribers();
  const results: {
    owner_id: string;
    to: string | null;
    status: "sent" | "skipped" | "error";
    detail?: string;
  }[] = [];

  for (const row of rows) {
    const outcome = await sendDigestForOwner(row.owner_id, { dryRun });
    if (outcome.status === "sent") {
      results.push({
        owner_id: row.owner_id,
        to: outcome.to,
        status: "sent",
      });
    } else if (outcome.status === "skipped") {
      results.push({
        owner_id: row.owner_id,
        to: outcome.to,
        status: "skipped",
        detail: outcome.detail,
      });
    } else {
      results.push({
        owner_id: row.owner_id,
        to: outcome.to,
        status: "error",
        detail: outcome.detail,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    count: rows.length,
    results,
  });
}
