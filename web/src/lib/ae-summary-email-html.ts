/**
 * Rich HTML for the stakeholder daily summary (intro, styled bullets, conclusion).
 */

import type { Account } from "@/lib/types";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applyBold(htmlEscaped: string): string {
  return htmlEscaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

/** `isoDate` is YYYY-MM-DD (calendar day, not UTC shift). */
function formatLongDate(isoYmd: string): string {
  const [y, m, d] = isoYmd.split("-").map(Number);
  if (!y || !m || !d) return isoYmd;
  const utc = new Date(Date.UTC(y, m - 1, d));
  return utc.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function renderCompletedTodaySection(
  accounts: Account[],
  timeZone: string,
  longDate: string,
): string {
  const tzLabel = esc(timeZone.replace(/_/g, " "));
  const expl =
    "These accounts show <strong>completed</strong> in the export and had a row refresh on <strong>" +
    esc(longDate) +
    "</strong> (<strong>" +
    tzLabel +
    "</strong> calendar).";

  if (accounts.length === 0) {
    return `
    <h2 style="font-size:17px;margin:1.35em 0 0.5em;padding-bottom:0.35em;border-bottom:2px solid #1a4d3a;color:#1a4d3a;">Completed today</h2>
    <p style="font-size:13px;color:#555;margin:0 0 0.85em;line-height:1.45;">${expl} <em>None matched for this send.</em></p>`;
  }

  const sorted = [...accounts].sort((a, b) => a.name.localeCompare(b.name));
  const items = sorted
    .map(
      (a) =>
        `<li style="margin:0.5em 0;padding:0.65em 0.85em;border:1px solid #c8ddd0;background:#f4faf6;border-left:4px solid #1a4d3a;list-style:none;font-size:14px;line-height:1.45;"><strong>${esc(a.name)}</strong> — ${esc(a.currency)} ${a.balance.toLocaleString("en-US")}</li>`,
    )
    .join("");

  return `
    <h2 style="font-size:17px;margin:1.35em 0 0.5em;padding-bottom:0.35em;border-bottom:2px solid #1a4d3a;color:#1a4d3a;">Completed today</h2>
    <p style="font-size:13px;color:#555;margin:0 0 0.85em;line-height:1.45;">${expl}</p>
    <ul style="margin:0;padding:0;">${items}</ul>`;
}

export type AeSummaryEmailExtras = {
  completedTodayAccounts: Account[];
  timeZone: string;
};

/**
 * @param body - Edited summary; paragraphs separated by blank lines; **bold** titles supported
 * @param recipientEmail - Recipient address (shown in header)
 * @param isoDate - YYYY-MM-DD (matches email subject)
 */
export function aeSummaryTextToEmailHtml(
  body: string,
  recipientEmail: string,
  isoDate: string,
  extras?: AeSummaryEmailExtras,
): string {
  const longDate = formatLongDate(isoDate);
  const paragraphs = body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const bulletsHtml = paragraphs
    .map((p) => {
      const inner = applyBold(esc(p)).replace(/\n/g, "<br/>");
      return `<li style="margin:0.75em 0;padding:0.85em 1em;border:1px solid #d4cfc4;background:#faf9f6;border-left:4px solid #a67c00;list-style:none;line-height:1.5;font-size:15px;">${inner}</li>`;
    })
    .join("");

  const introHtml = `
<section style="margin:1.25em 0;padding:1.05em 1.15em;border:1px solid #ccc;background:linear-gradient(180deg,#faf8f4 0%,#f5f2eb 100%);box-shadow:0 1px 0 rgba(0,0,0,0.06);">
  <p style="margin:0 0 0.65em;font-size:15px;line-height:1.55;color:#2a2a2a;">
    Hello — this <strong>end-of-day update</strong> was prepared for you,
    dated <strong>${esc(longDate)}</strong>. It highlights where the book stands so you are not left guessing
    what moved today.
  </p>
  <p style="margin:0;font-size:14px;line-height:1.5;color:#444;">
    The section below is drawn from the latest export and saved notes; it may have been edited before sending.
    Facts are only as complete as what was in the system — follow up on anything that needs more color.
  </p>
</section>`;

  const conclusionHtml = `
<section style="margin:1.75em 0 0;padding:1.05em 1.15em;border:1px solid #c5d4e0;background:#f0f5fa;">
  <p style="margin:0 0 0.6em;font-size:15px;line-height:1.55;color:#1f2d3a;">
    <strong>Next steps.</strong> If something needs clarification, or you want more detail on a specific account,
    reply to this message and the sender can follow up directly.
  </p>
  <p style="margin:0;font-size:14px;line-height:1.5;color:#3d4f5f;">
    Thanks for the partnership — we&rsquo;ll keep you posted as accounts progress.
  </p>
</section>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Daily account update</title>
</head>
<body style="margin:0;padding:24px 16px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;background:#f7f7f7;">
  <div style="max-width:640px;margin:0 auto;background:#fff;padding:28px 26px 32px;border:1px solid #ddd;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <p style="text-transform:lowercase;font-size:12px;letter-spacing:0.08em;color:#666;margin:0 0 0.25em;">business update</p>
    <h1 style="font-size:24px;font-weight:700;margin:0 0 0.35em;line-height:1.2;color:#1a1a1a;">Daily account update</h1>
    <p style="margin:0 0 0.15em;font-size:14px;color:#444;">To: ${esc(recipientEmail)}</p>
    <p style="margin:0 0 1em;font-size:13px;color:#666;">${esc(longDate)}</p>

    ${introHtml}
    ${
      extras
        ? renderCompletedTodaySection(
            extras.completedTodayAccounts,
            extras.timeZone,
            longDate,
          )
        : ""
    }

    <h2 style="font-size:17px;margin:1.35em 0 0.5em;padding-bottom:0.35em;border-bottom:2px solid #1a1a1a;color:#1a1a1a;">Where things stand</h2>
    <p style="font-size:13px;color:#555;margin:0 0 0.85em;line-height:1.45;">Summary bullets — each line is a focal point from today&rsquo;s data and notes.</p>
    <ul style="margin:0;padding:0;">${bulletsHtml}</ul>

    ${conclusionHtml}

    <p style="margin-top:1.75em;padding-top:1em;border-top:1px solid #e5e5e5;font-size:12px;color:#888;line-height:1.45;">
      This message was sent from your business dashboard. Content reflects the export and notes available at send time.
      ${
        extras
          ? ` <strong>Completed today</strong> matches accounts that show completed status in the export and whose row was refreshed on the date above using the <strong>${esc(extras.timeZone.replace(/_/g, " "))}</strong> calendar.`
          : ""
      }
    </p>
  </div>
</body>
</html>`;
}
