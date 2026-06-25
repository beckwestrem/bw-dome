import { NextResponse } from "next/server";

import { PdfLibEzSavePdfService } from "@/programs/ladwp_ez_save/pdf-service";
import {
  LadwpFaxSubmissionService,
  WebhookFaxProvider,
} from "@/programs/ladwp_ez_save/submission-service";
import type { LadwpEzSaveApplicationDraft } from "@/programs/ladwp_ez_save/types";

function faxProvider() {
  const webhookUrl = process.env.LADWP_EZ_SAVE_FAX_WEBHOOK_URL;
  return webhookUrl ? new WebhookFaxProvider(webhookUrl) : undefined;
}

export async function POST(request: Request) {
  try {
    const draft = (await request.json()) as LadwpEzSaveApplicationDraft;
    const service = new LadwpFaxSubmissionService(
      new PdfLibEzSavePdfService(),
      faxProvider(),
    );
    const result = await service.sendFax(draft);
    return NextResponse.json(result, { status: result.ok ? 200 : 501 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    console.error("[ladwp-ez-save/submit/fax]", message);
    return NextResponse.json(
      { error: "Could not prepare the fax submission right now." },
      { status: 500 },
    );
  }
}
