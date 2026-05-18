import { NextResponse } from "next/server";

import { resolveOwnerId } from "@/lib/request-owner";
import { sendDigestForOwner } from "@/lib/send-digest-for-owner";

export const maxDuration = 120;

/** Send one digest to the signed-in user (does not require digest toggle). */
export async function POST() {
  const ownerId = await resolveOwnerId();
  const outcome = await sendDigestForOwner(ownerId);

  if (outcome.status === "sent") {
    return NextResponse.json({
      ok: true,
      to: outcome.to,
      message: `SMTP accepted the message for ${outcome.to}. Check inbox and spam.`,
      messageId: outcome.messageId,
    });
  }

  if (outcome.status === "skipped") {
    return NextResponse.json(
      {
        ok: false,
        skipped: true,
        to: outcome.to,
        detail: outcome.detail,
      },
      { status: 422 },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      to: outcome.to,
      detail: outcome.detail,
    },
    { status: 500 },
  );
}
