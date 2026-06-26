import { NextResponse } from "next/server";

import {
  applyElectronicSignatureToPdf,
  PdfLibEzSavePdfService,
} from "@/programs/ladwp_ez_save/pdf-service";
import {
  WebhookFaxProvider,
} from "@/programs/ladwp_ez_save/submission-service";
import {
  createEzSaveSubmission,
  LADWP_EZ_SAVE_CONSENT_VERSION,
  updateEzSaveSubmissionFaxStatus,
} from "@/programs/ladwp_ez_save/submission-store";
import type { LadwpEzSaveApplicationDraft } from "@/programs/ladwp_ez_save/types";
import { LADWP_EZ_SAVE_WORKFLOW } from "@/programs/ladwp_ez_save/workflow";

function faxProvider() {
  const webhookUrl = process.env.LADWP_EZ_SAVE_FAX_WEBHOOK_URL;
  return webhookUrl ? new WebhookFaxProvider(webhookUrl) : undefined;
}

type FaxRequestBody = {
  draft?: LadwpEzSaveApplicationDraft;
  signature?: {
    signerName?: string;
    signerEmail?: string | null;
    consentAccepted?: boolean;
  };
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FaxRequestBody;
    const draft = body.draft;
    const signerName = body.signature?.signerName?.trim();
    const signerEmail = body.signature?.signerEmail?.trim() || null;

    if (!draft) {
      return NextResponse.json({ error: "Missing application draft." }, { status: 400 });
    }
    if (!signerName || !body.signature?.consentAccepted) {
      return NextResponse.json(
        { error: "Review and electronically sign before faxing." },
        { status: 400 },
      );
    }

    const pdfService = new PdfLibEzSavePdfService();
    const pdf = await pdfService.fillApplicationPdf(draft);
    if (!pdf.ok) {
      return NextResponse.json({ error: pdf.reason }, { status: 500 });
    }

    const signedAt = new Date();
    const signedPdf = await applyElectronicSignatureToPdf(pdf.bytes, {
      signerName,
      signedAt,
      consentVersion: LADWP_EZ_SAVE_CONSENT_VERSION,
    });
    const provider = faxProvider();
    const submission = await createEzSaveSubmission({
      signerName,
      signerEmail,
      signedPdf,
      faxProvider: provider ? "webhook" : null,
    });

    if (!submission) {
      return NextResponse.json(
        {
          ok: false,
          status: "not_configured",
          faxNumber: LADWP_EZ_SAVE_WORKFLOW.faxNumber,
          reason:
            "DATABASE_URL is not configured, so this app cannot save a signed submission record yet.",
        },
        { status: 501 },
      );
    }

    if (!provider) {
      await updateEzSaveSubmissionFaxStatus(submission.id, {
        status: "fax_failed",
        detail:
          "Fax provider is not configured yet. The signed PDF record was saved.",
      });
      return NextResponse.json(
        {
          ok: false,
          status: "not_configured",
          faxNumber: LADWP_EZ_SAVE_WORKFLOW.faxNumber,
          receiptToken: submission.receiptToken,
          receiptUrl: `/ez-save/receipt/${submission.receiptToken}`,
          reason:
            "Fax sending is ready for a provider, but no fax provider is configured yet.",
        },
        { status: 501 },
      );
    }

    const providerResult = await provider.sendFax({
      to: LADWP_EZ_SAVE_WORKFLOW.faxNumber,
      fileName: pdf.fileName,
      pdfBase64: Buffer.from(signedPdf).toString("base64"),
    });

    if (!providerResult.ok) {
      const updated = await updateEzSaveSubmissionFaxStatus(submission.id, {
        status: "fax_failed",
        detail: providerResult.reason,
      });
      return NextResponse.json(
        {
          ok: false,
          status: "provider_error",
          faxNumber: LADWP_EZ_SAVE_WORKFLOW.faxNumber,
          receiptToken: submission.receiptToken,
          receiptUrl: `/ez-save/receipt/${submission.receiptToken}`,
          reason: updated?.faxStatusDetail ?? providerResult.reason,
        },
        { status: 502 },
      );
    }

    const updated = await updateEzSaveSubmissionFaxStatus(submission.id, {
      status: "fax_sent",
      confirmationId: providerResult.confirmationId,
      detail: "Fax submitted to LADWP. Keep the confirmation number with your records.",
    });
    return NextResponse.json({
      ok: true,
      status: "fax_sent",
      faxNumber: LADWP_EZ_SAVE_WORKFLOW.faxNumber,
      confirmationId: providerResult.confirmationId,
      receiptToken: submission.receiptToken,
      receiptUrl: `/ez-save/receipt/${submission.receiptToken}`,
      message:
        updated?.faxStatusDetail ??
        "Fax submitted to LADWP. Keep the confirmation number with your records.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    console.error("[ladwp-ez-save/submit/fax]", message);
    return NextResponse.json(
      { error: "Could not prepare the fax submission right now." },
      { status: 500 },
    );
  }
}
