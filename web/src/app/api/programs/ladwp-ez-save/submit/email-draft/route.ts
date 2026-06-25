import { NextResponse } from "next/server";

import { prepareLadwpEmailDraft } from "@/programs/ladwp_ez_save/submission-service";
import type { LadwpEzSaveApplicationDraft } from "@/programs/ladwp_ez_save/types";

export async function POST(request: Request) {
  try {
    const draft = (await request.json()) as LadwpEzSaveApplicationDraft;
    return NextResponse.json(prepareLadwpEmailDraft(draft));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    console.error("[ladwp-ez-save/submit/email-draft]", message);
    return NextResponse.json(
      { error: "Could not prepare the email draft right now." },
      { status: 500 },
    );
  }
}
