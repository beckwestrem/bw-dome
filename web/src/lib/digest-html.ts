import type { Account, AppData } from "@/lib/types";
import { sortAccountsByUrgency } from "@/lib/account-ranking";
import { buildDailyAmDigestBullets } from "@/lib/digest-daily-summary";
import { buildActionItems } from "@/lib/insights";

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escHtmlMultiline(s: string): string {
  return escHtml(s).split(/\r?\n/).join("<br/>");
}

function priorityOrder(p: "high" | "medium" | "low"): number {
  if (p === "high") return 0;
  if (p === "medium") return 1;
  return 2;
}

/** One-line orientation: personal digest vs stakeholder update workflow. */
const AM_DIGEST_INTRO_HTML = `<p style="margin:1em 0;font-size:14px;line-height:1.45;color:#444;">Your personal snapshot from this upload. For a shareable summary, use <strong>Settings → Daily summary for a stakeholder</strong>.</p>`;

export function buildDigestPayload(data: AppData) {
  const actions = buildActionItems(data.accounts, data.transactions).sort(
    (a, b) => priorityOrder(a.priority) - priorityOrder(b.priority),
  );
  const accountsRanked = sortAccountsByUrgency(data.accounts);
  const primaryCurrency = accountsRanked[0]?.currency ?? "USD";
  const bookTotal = data.accounts.reduce((sum, a) => sum + a.balance, 0);

  const highlights = [
    `${data.accounts.length} accounts in this upload.`,
    `${data.transactions.length} data rows read from the file.`,
    `Total value is ${new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: primaryCurrency,
    }).format(bookTotal)} — eyeball this against your source file if unsure.`,
  ];

  return { highlights, actions, accountsRanked, primaryCurrency, bookTotal };
}

export type RenderDigestHtmlOptions = {
  /** When set and length is 5, used instead of rule-based bullets. */
  summaryBullets?: string[];
};

export function renderDigestHtml(
  recipientEmail: string,
  data: AppData,
  topAccounts: Account[],
  digestFooterNotes: string | null | undefined,
  options?: RenderDigestHtmlOptions,
): string {
  const { highlights, actions } = buildDigestPayload(data);
  const pre = options?.summaryBullets;
  const usedPre =
    Array.isArray(pre) &&
    pre.length === 5 &&
    pre.every((b) => typeof b === "string" && b.trim().length > 0);
  const summaryBullets = usedPre
    ? pre.map((b) => b.trim())
    : buildDailyAmDigestBullets(data, actions);

  const hlHtml = highlights
    .map((h) => `<li style="margin:0.35em 0;">${escHtml(h)}</li>`)
    .join("");

  const summaryHtml = summaryBullets
    .map((b) => `<li style="margin:0.5em 0;line-height:1.45;">${escHtml(b)}</li>`)
    .join("");

  const actionsHtml = actions
    .slice(0, 25)
    .map(
      (a) => `
      <li style="margin:1em 0;padding:0.75em;border:1px solid #ccc;background:#fafafa;">
        <strong style="color:${a.priority === "high" ? "#7c1d1d" : "#333"};">[${a.priority}] ${escHtml(a.title)}</strong>
        <p style="margin:0.35em 0 0;font-size:14px;">${escHtml(a.why)}</p>
        <p style="margin:0.35em 0 0;font-size:14px;"><em>Next:</em> ${escHtml(a.nextStep)}</p>
      </li>`,
    )
    .join("");

  const topNames = topAccounts
    .slice(0, 12)
    .map(
      (a) =>
        `<li>${escHtml(a.name)} — ${escHtml(a.currency)} ${a.balance.toLocaleString()}</li>`,
    )
    .join("");

  const notesTrim = digestFooterNotes?.trim();
  const yourNotesSection = notesTrim
    ? `
  <h2 style="font-size:16px;margin-top:1.5em;">Your notes</h2>
  <p style="font-size:13px;color:#555;margin:0 0 0.65em;line-height:1.4;">
    Anything you want on your own radar that the export does not capture — reminders, verbal commitments, blockers, escalations.
  </p>
  <div style="white-space:pre-wrap;font-size:14px;line-height:1.45;border:1px dashed #888;padding:0.85em;background:#fff;">${escHtmlMultiline(notesTrim)}</div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Your business digest</title></head>
<body style="font-family:system-ui,sans-serif;max-width:640px;margin:24px auto;color:#111;">
  <p style="text-transform:lowercase;font-size:12px;letter-spacing:0.08em;color:#555;">business dashboard</p>
  <h1 style="font-size:22px;margin:0 0 0.5em;">Your digest (from export)</h1>
  <p style="color:#444;">To: ${escHtml(recipientEmail)}</p>

  ${AM_DIGEST_INTRO_HTML}

  <h2 style="font-size:16px;margin-top:1.5em;">Your book in ~5 bullets</h2>
  <ul style="padding-left:1.2em;margin-top:0;">${summaryHtml}</ul>
${yourNotesSection}

  <h2 style="font-size:16px;margin-top:1.5em;">Snapshot</h2>
  <ul style="padding-left:1.2em;">${hlHtml}</ul>
  <h2 style="font-size:16px;margin-top:1.5em;">Top accounts (urgency)</h2>
  <ol style="padding-left:1.2em;">${topNames}</ol>
  <h2 style="font-size:16px;margin-top:1.5em;">Detailed action items</h2>
  <ul style="list-style:none;padding:0;">${actionsHtml}</ul>
  ${actions.length > 25 ? `<p style="color:#666;font-size:14px;">Showing 25 of ${actions.length} actions — open the app for the full list.</p>` : ""}
  <p style="margin-top:2em;font-size:13px;color:#666;">Automated from your upload. Edit notes in Settings anytime; scheduled digests use what you last saved.</p>
</body>
</html>`;
}
