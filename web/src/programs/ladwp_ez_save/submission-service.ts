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
    contentUrl?: string;
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
    contentUrl?: string;
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

export class SinchFaxProvider implements LadwpFaxProvider {
  constructor(
    private readonly config: {
      projectId: string;
      accessKey: string;
      accessSecret: string;
      callbackUrl?: string | null;
    },
  ) {}

  async sendFax(input: {
    to: string;
    fileName: string;
    pdfBase64: string;
    contentUrl?: string;
  }): Promise<{ ok: true; confirmationId: string } | { ok: false; reason: string }> {
    if (!input.contentUrl) {
      return { ok: false, reason: "Sinch Fax requires a public PDF content URL." };
    }

    const response = await fetch(
      `https://fax.api.sinch.com/v3/projects/${encodeURIComponent(
        this.config.projectId,
      )}/faxes`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${this.config.accessKey}:${this.config.accessSecret}`,
          ).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: toE164(input.to),
          contentUrl: input.contentUrl,
          ...(this.config.callbackUrl
            ? { callbackUrl: this.config.callbackUrl }
            : {}),
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        reason: `Sinch Fax returned ${response.status}.${detail ? ` ${detail}` : ""}`,
      };
    }

    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const confirmationId =
      stringField(json, "id") ??
      stringField(json, "faxId") ??
      stringField(json, "fax_id") ??
      stringField(json, "confirmationId") ??
      "submitted";
    return { ok: true, confirmationId };
  }
}

function stringField(value: Record<string, unknown>, key: string) {
  const field = value[key];
  return typeof field === "string" && field.trim() ? field : undefined;
}

function toE164(phone: string) {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) return trimmed.replace(/[^\d+]/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return trimmed;
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
