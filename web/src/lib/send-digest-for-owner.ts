import { sortAccountsByUrgency } from "@/lib/account-ranking";
import { buildDigestPayload, renderDigestHtml } from "@/lib/digest-html";
import { tryGenerateDigestBulletsWithLlm } from "@/lib/llm/digest-summary-llm";
import { resolveDigestRecipientEmail } from "@/lib/resolve-digest-email";
import { readAppData } from "@/lib/storage";
import { sendDigestEmail, smtpConfigured } from "@/lib/send-digest-smtp";

export type DigestSendOutcome =
  | { status: "sent"; to: string; messageId?: string }
  | { status: "skipped"; to: string | null; detail: string }
  | { status: "error"; to: string | null; detail: string };

type Options = {
  /** List recipients only (cron dry run). */
  dryRun?: boolean;
};

/**
 * Build and send one digest email for a data owner (settings + upload from storage).
 * Used by cron and by the authenticated “send now” action.
 */
export async function sendDigestForOwner(
  ownerId: string,
  options?: Options,
): Promise<DigestSendOutcome> {
  const dryRun = options?.dryRun ?? false;

  const data = await readAppData(ownerId);
  const to = await resolveDigestRecipientEmail(
    ownerId,
    data.settings.digestEmail,
  );

  if (!to) {
    return {
      status: "skipped",
      to: null,
      detail:
        "No recipient email. Set “Digest email” in Settings.",
    };
  }

  if (dryRun) {
    return { status: "skipped", to, detail: "dry_run" };
  }

  if (!smtpConfigured()) {
    return {
      status: "error",
      to,
      detail:
        "SMTP not configured. Set SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD, DIGEST_SENDER_EMAIL on the server.",
    };
  }

  if (data.accounts.length === 0 && data.transactions.length === 0) {
    return {
      status: "skipped",
      to,
      detail: "No data uploaded yet.",
    };
  }

  try {
    const ranked = sortAccountsByUrgency(data.accounts);
    const { actions } = buildDigestPayload(data);
    const llmBullets = await tryGenerateDigestBulletsWithLlm(
      data,
      actions,
      data.settings.digestFooterNotes,
    );
    const html = renderDigestHtml(
      to,
      data,
      ranked,
      data.settings.digestFooterNotes,
      llmBullets ? { summaryBullets: llmBullets } : undefined,
    );
    const date = new Date().toISOString().slice(0, 10);
    const { messageId } = await sendDigestEmail({
      to,
      subject: `Your business digest — ${date}`,
      html,
    });
    return { status: "sent", to, messageId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "send failed";
    return { status: "error", to, detail: msg };
  }
}
