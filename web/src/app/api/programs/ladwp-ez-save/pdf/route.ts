import { NextResponse } from "next/server";

import { PdfLibEzSavePdfService } from "@/programs/ladwp_ez_save/pdf-service";
import type { LadwpEzSaveApplicationDraft } from "@/programs/ladwp_ez_save/types";

export async function POST(request: Request) {
  const draft = (await request.json()) as LadwpEzSaveApplicationDraft;
  const service = new PdfLibEzSavePdfService();
  const result = await service.fillApplicationPdf(draft);

  if (!result.ok) {
    return NextResponse.json({ reason: result.reason }, { status: 500 });
  }

  return new NextResponse(Buffer.from(result.bytes), {
    headers: {
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
      "Content-Type": "application/pdf",
    },
  });
}
