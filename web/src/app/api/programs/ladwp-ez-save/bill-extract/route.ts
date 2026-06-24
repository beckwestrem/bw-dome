import { NextResponse } from "next/server";

import { LocalTextBillExtractionService } from "@/programs/ladwp_ez_save/bill-extraction-service";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("bill");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Upload a utility bill file to prefill fields." },
        { status: 400 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const service = new LocalTextBillExtractionService();
    return NextResponse.json(
      await service.extract({
        fileName: file.name,
        contentType: file.type,
        bytes,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    console.error("[ladwp-ez-save/bill-extract]", message);
    return NextResponse.json(
      { error: "Could not read that utility bill right now." },
      { status: 500 },
    );
  }
}
