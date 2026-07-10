import { NextResponse } from "next/server";

function eventType(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const body = payload as Record<string, unknown>;
  const data = body.data;
  if (data && typeof data === "object") {
    const type = (data as Record<string, unknown>).event_type;
    if (typeof type === "string" && type.trim()) return type;
  }
  const type = body.event_type ?? body.type;
  return typeof type === "string" && type.trim() ? type : null;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    webhook: "telnyx-fax",
  });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => null)) as unknown;
    console.info("[telnyx/fax webhook]", eventType(payload) ?? "event received");
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook error";
    console.error("[telnyx/fax webhook]", message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
