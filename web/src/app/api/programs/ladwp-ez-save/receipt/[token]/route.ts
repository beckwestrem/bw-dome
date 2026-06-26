import { NextResponse } from "next/server";

import { getEzSaveSubmissionByReceiptToken } from "@/programs/ladwp_ez_save/submission-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const submission = await getEzSaveSubmissionByReceiptToken(token);

  if (!submission) {
    return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
  }

  return NextResponse.json(submission);
}
