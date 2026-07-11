import { NextResponse } from "next/server";

import { firstPageOnlyPdf } from "@/programs/ladwp_ez_save/pdf-service";
import { getEzSaveSignedPdfByReceiptToken } from "@/programs/ladwp_ez_save/submission-store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const pdf = await getEzSaveSignedPdfByReceiptToken(token);

  if (!pdf) {
    return NextResponse.json({ error: "Signed PDF not found." }, { status: 404 });
  }

  const faxOnly = new URL(request.url).searchParams.get("fax") === "1";
  const bytes = faxOnly
    ? await firstPageOnlyPdf(Uint8Array.from(pdf.bytes))
    : Uint8Array.from(pdf.bytes);
  const responseBody = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(responseBody).set(bytes);

  return new NextResponse(responseBody, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${
        faxOnly ? "ladwp-ez-save-application-fax.pdf" : pdf.fileName
      }"`,
      "Cache-Control": "private, no-store",
    },
  });
}
