import { LADWP_EZ_SAVE_WORKFLOW } from "./workflow";
import type { PdfFillResult } from "./pdf-service";
import type { LadwpEzSaveApplicationDraft } from "./types";

export type FaxSubmissionResult =
  | {
      ok: true;
      confirmationId: string;
      faxNumber: string;
      message: string;
    }
  | {
      ok: false;
      status: "not_configured" | "pdf_error" | "provider_error";
      faxNumber: string;
      reason: string;
    };

export interface LadwpFaxProvider {
  sendFax(input: {
    to: string;
    fileName: string;
    pdfBase64: string;
  }): Promise<{ ok: true; confirmationId: string } | { ok: false; reason: string }>;
}

type PdfGenerator = {
  fillApplicationPdf(draft: LadwpEzSaveApplicationDraft): Promise<PdfFillResult>;
};

export class WebhookFaxProvider implements LadwpFaxProvider {
  constructor(private readonly webhookUrl: string) {}

  async sendFax(input: {
    to: string;
    fileName: string;
    pdfBase64: string;
  }): Promise<{ ok: true; confirmationId: string } | { ok: false; reason: string }> {
    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      return { ok: false, reason: `Fax provider returned ${response.status}.` };
    }

    const json = (await response.json()) as { confirmationId?: unknown };
    return {
      ok: true,
      confirmationId:
        typeof json.confirmationId === "string" ? json.confirmationId : "submitted",
    };
  }
}

export class LadwpFaxSubmissionService {
  constructor(
    private readonly pdfGenerator: PdfGenerator,
    private readonly faxProvider?: LadwpFaxProvider,
  ) {}

  async sendFax(draft: LadwpEzSaveApplicationDraft): Promise<FaxSubmissionResult> {
    if (!this.faxProvider) {
      return {
        ok: false,
        status: "not_configured",
        faxNumber: LADWP_EZ_SAVE_WORKFLOW.faxNumber,
        reason:
          "Fax sending is ready for a provider, but no fax provider is configured yet. Download the signed PDF and fax it to LADWP manually for now.",
      };
    }

    const pdf = await this.pdfGenerator.fillApplicationPdf(draft);
    if (!pdf.ok) {
      return {
        ok: false,
        status: "pdf_error",
        faxNumber: LADWP_EZ_SAVE_WORKFLOW.faxNumber,
        reason: pdf.reason,
      };
    }

    const providerResult = await this.faxProvider.sendFax({
      to: LADWP_EZ_SAVE_WORKFLOW.faxNumber,
      fileName: pdf.fileName,
      pdfBase64: Buffer.from(pdf.bytes).toString("base64"),
    });

    if (!providerResult.ok) {
      return {
        ok: false,
        status: "provider_error",
        faxNumber: LADWP_EZ_SAVE_WORKFLOW.faxNumber,
        reason: providerResult.reason,
      };
    }

    return {
      ok: true,
      confirmationId: providerResult.confirmationId,
      faxNumber: LADWP_EZ_SAVE_WORKFLOW.faxNumber,
      message:
        "Fax submitted to LADWP. Keep the confirmation number with your records.",
    };
  }
}
