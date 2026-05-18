import { NextResponse } from "next/server";

import {
  listAccountsCompletedUpdatedToday,
  resolveSummaryTimeZone,
  todayCalendarDateInTimeZone,
} from "@/lib/completed-today";
import { aeSummaryTextToEmailHtml } from "@/lib/ae-summary-email-html";
import { resolveOwnerId } from "@/lib/request-owner";
import { readAppData } from "@/lib/storage";
import { sendDigestEmail, smtpConfigured } from "@/lib/send-digest-smtp";

export const maxDuration = 60;

const EMAIL_RE =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Body = {
  to?: string;
  text?: string;
};

/** Send the edited stakeholder daily summary to the address provided by the user. */
export async function POST(request: Request) {
  const ownerId = await resolveOwnerId();
  const appData = await readAppData(ownerId);

  let json: Body;
  try {
    json = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const to = typeof json.to === "string" ? json.to.trim() : "";
  const text = typeof json.text === "string" ? json.text.trim() : "";

  if (!to || !EMAIL_RE.test(to)) {
    return NextResponse.json(
      { error: "Enter a valid recipient email address." },
      { status: 422 },
    );
  }

  if (!text) {
    return NextResponse.json(
      { error: "Summary text is empty. Generate or paste content before sending." },
      { status: 422 },
    );
  }

  if (!smtpConfigured()) {
    return NextResponse.json(
      {
        error:
          "SMTP not configured. Set SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD, DIGEST_SENDER_EMAIL on the server.",
      },
      { status: 503 },
    );
  }

  const timeZone = resolveSummaryTimeZone();
  const date = todayCalendarDateInTimeZone(timeZone);
  const subject = `Daily account update — ${date}`;
  const completedToday = listAccountsCompletedUpdatedToday(
    appData.accounts,
    timeZone,
  );

  try {
    const html = aeSummaryTextToEmailHtml(text, to, date, {
      completedTodayAccounts: completedToday,
      timeZone,
    });
    const { messageId } = await sendDigestEmail({ to, subject, html });
    return NextResponse.json({
      ok: true,
      to,
      message: `Message accepted for delivery to ${to}.`,
      messageId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Send failed.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
