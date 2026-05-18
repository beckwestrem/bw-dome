import { NextResponse } from "next/server";

import { CsvUploadAdapter } from "@/lib/csv-upload-adapter";
import { replaceCsvUploadInApp } from "@/lib/merge-ingestion";
import { resolveOwnerId } from "@/lib/request-owner";
import { scopeIngestionToOwner } from "@/lib/scope-ingestion-ids";
import { readAppData, writeAppData } from "@/lib/storage";

/** Large CSV + batched DB write; avoid platform timeouts where supported. */
export const maxDuration = 120;

function isBlobWithText(x: unknown): x is Blob {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as Blob).text === "function"
  );
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!isBlobWithText(file)) {
      return NextResponse.json({ error: "Missing file upload." }, { status: 400 });
    }

    const uploadName = file instanceof File ? file.name : "upload.csv";
    const csvText = await file.text();
    const defaultAccountRaw = formData.get("defaultAccountName");
    const defaultAccountName =
      typeof defaultAccountRaw === "string" ? defaultAccountRaw : undefined;

    const result = CsvUploadAdapter.parse({
      fileName: uploadName,
      csvText,
      defaultAccountName,
    });

    if (!result.ok) {
      if ("error" in result && result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      if ("issues" in result) {
        return NextResponse.json(
          { error: "CSV validation failed", issues: result.issues },
          { status: 422 },
        );
      }
      return NextResponse.json({ error: "Upload failed" }, { status: 400 });
    }

    const ownerId = await resolveOwnerId();
    const scoped = scopeIngestionToOwner(ownerId, result.data);
    const current = await readAppData(ownerId);
    const next = replaceCsvUploadInApp(current, scoped, {
      id: `${Date.now()}`,
      sourceType: "csv_upload",
    });
    await writeAppData(ownerId, next);

    return NextResponse.json({
      ok: true,
      accountsImported: scoped.accounts.length,
      transactionsImported: scoped.transactions.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[upload]", message);
    return NextResponse.json(
      {
        error:
          "Could not save this upload (server or database error). Try again or use a smaller file.",
        detail: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 },
    );
  }
}
