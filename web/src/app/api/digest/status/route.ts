import { NextResponse } from "next/server";

import { resolveOwnerId } from "@/lib/request-owner";
import { resolveDigestRecipientEmail } from "@/lib/resolve-digest-email";
import { readAppData } from "@/lib/storage";
import { smtpConfigured, smtpMissingEnvNames } from "@/lib/send-digest-smtp";

/**
 * Diagnostics for digest delivery (current user). Does not send mail.
 * Helps verify SMTP env, recipient resolution, data, and scheduled-digest toggle.
 */
export async function GET() {
  const ownerId = await resolveOwnerId();
  const data = await readAppData(ownerId);
  const recipient = await resolveDigestRecipientEmail(
    ownerId,
    data.settings.digestEmail,
  );
  const hasData =
    data.accounts.length > 0 || data.transactions.length > 0;

  const isDev = process.env.NODE_ENV === "development";
  const envHint = isDev
    ? "Local: put SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD, and DIGEST_SENDER_EMAIL in web/.env.local (see web/.env.example), then restart npm run dev."
    : "Set missing vars on the same Railway service that runs Next (often named like your repo), then redeploy.";

  return NextResponse.json({
    smtpConfigured: smtpConfigured(),
    smtpMissingEnvNames: smtpMissingEnvNames(),
    recipient,
    hasData,
    digestScheduled: data.settings.emailDigestEnabled,
    hint: `${envHint} Scheduled digests only run if a cron job POSTs /api/cron/digest with CRON_SECRET; use “Send test now” to bypass that.`,
  });
}
