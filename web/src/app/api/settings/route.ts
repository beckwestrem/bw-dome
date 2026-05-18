import { NextResponse } from "next/server";

import { resolveOwnerId } from "@/lib/request-owner";
import { readAppData, updateSettings } from "@/lib/storage";

export async function GET() {
  const ownerId = await resolveOwnerId();
  const data = await readAppData(ownerId);
  return NextResponse.json(data.settings);
}

export async function POST(request: Request) {
  const ownerId = await resolveOwnerId();
  const body = (await request.json()) as {
    emailDigestEnabled?: boolean;
    sendTimesLocal?: [string, string];
    digestEmail?: string | null;
    digestFooterNotes?: string | null;
  };
  const next = await updateSettings(ownerId, {
    emailDigestEnabled: body.emailDigestEnabled,
    sendTimesLocal: body.sendTimesLocal,
    digestEmail:
      body.digestEmail === undefined
        ? undefined
        : (body.digestEmail ?? "").trim() || null,
    digestFooterNotes:
      body.digestFooterNotes === undefined
        ? undefined
        : (body.digestFooterNotes ?? "").trim() || null,
  });
  return NextResponse.json(next);
}
