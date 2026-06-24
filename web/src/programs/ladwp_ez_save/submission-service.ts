import { LADWP_EZ_SAVE_WORKFLOW } from "./workflow";
import type { PdfFillResult } from "./pdf-service";
import type { LadwpEzSaveApplicationDraft } from "./types";

export type EmailDraftResult = {
  ok: true;
  mailtoHref: string;
  fileName: string;
  recipientEmail: string | null;
  attachmentReminder: string;
  officialSubmissionNote: string;
};

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

function applicantName(draft: LadwpEzSaveApplicationDraft) {
  const fields = new Map(draft.fields.map((field) => [field.fieldKey, field.value]));
  return [fields.get("first_name"), fields.get("last_name")]
    .filter((value): value is string => typeof value === "string" && value.trim() !== "")
    .join(" ");
}

function buildMailtoHref(draft: LadwpEzSaveApplicationDraft, fileName: string) {
  const recipient = LADWP_EZ_SAVE_WORKFLOW.emailSubmissionAddress;
  const name = applicantName(draft);
  const subject = "LADWP EZ-SAVE application";
  const body = [
    "Hello,",
    "",
    `Please find the LADWP EZ-SAVE application${name ? ` for ${name}` : ""}.`,
    "",
    `Attach this signed PDF before sending: ${fileName}`,
    "",
    "Official LADWP EZ-SAVE submission options listed in the application packet are online, fax, and mail. Use email only if you have confirmed the recipient accepts EZ-SAVE applications.",
    "",
    `Fax: ${LADWP_EZ_SAVE_WORKFLOW.faxNumber}`,
    `Mail: ${LADWP_EZ_SAVE_WORKFLOW.mailAddress.join(", ")}`,
  ].join("\n");

  return `mailto:${recipient ?? ""}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}

export function prepareLadwpEmailDraft(
  draft: LadwpEzSaveApplicationDraft,
  fileName = "ladwp-ez-save-application-draft.pdf",
): EmailDraftResult {
  return {
    ok: true,
    mailtoHref: buildMailtoHref(draft, fileName),
    fileName,
    recipientEmail: LADWP_EZ_SAVE_WORKFLOW.emailSubmissionAddress,
    attachmentReminder:
      "Email apps do not allow websites to attach generated PDFs automatically. Download the packet, sign it, then attach it to the email draft.",
    officialSubmissionNote: LADWP_EZ_SAVE_WORKFLOW.emailSubmissionNote,
  };
}

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
