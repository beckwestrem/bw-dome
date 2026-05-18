import { NextResponse } from "next/server";

import { StubEzSavePdfService } from "@/programs/ladwp_ez_save/pdf-service";

export async function POST() {
  const service = new StubEzSavePdfService();
  const result = await service.fillApplicationPdf();
  return NextResponse.json(result, { status: result.ok ? 200 : 501 });
}
