import { NextResponse } from "next/server";

import { getEzSaveSignedPdfByReceiptToken } from "@/programs/ladwp_ez_save/submission-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const pdf = await getEzSaveSignedPdfByReceiptToken(token);

  if (!pdf) {
    return NextResponse.json({ error: "Signed PDF not found." }, { status: 404 });
  }

  return new NextResponse(pdf.bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdf.fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
