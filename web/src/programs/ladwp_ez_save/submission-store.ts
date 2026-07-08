import { createHash, randomBytes, randomUUID } from "node:crypto";

import { ensureSchema, getSql } from "@/lib/db";

import { LADWP_EZ_SAVE_WORKFLOW } from "./workflow";

export const LADWP_EZ_SAVE_CONSENT_VERSION = "2026-06-26";
export const LADWP_EZ_SAVE_CONSENT_TEXT =
  "I reviewed this LADWP EZ-SAVE application, confirm the information is true to the best of my knowledge, and authorize this app to apply my electronic signature and fax the signed application to LADWP.";

export type EzSaveSubmissionStatus =
  | "signed"
  | "fax_pending"
  | "fax_sent"
  | "fax_failed";

export type EzSaveSubmissionRecord = {
  id: string;
  receiptToken: string;
  status: EzSaveSubmissionStatus;
  signerName: string | null;
  signerEmail: string | null;
  consentText: string;
  consentVersion: string;
  signedAt: string | null;
  faxNumber: string;
  faxProvider: string | null;
  faxConfirmationId: string | null;
  faxStatusDetail: string | null;
  pdfSha256: string | null;
  createdAt: string;
  updatedAt: string;
};

type SubmissionRow = {
  id: string;
  receipt_token: string;
  status: EzSaveSubmissionStatus;
  signer_name: string | null;
  signer_email: string | null;
  consent_text: string;
  consent_version: string;
  signed_at: Date | null;
  fax_number: string;
  fax_provider: string | null;
  fax_confirmation_id: string | null;
  fax_status_detail: string | null;
  pdf_sha256: string | null;
  created_at: Date;
  updated_at: Date;
};

function rowToRecord(row: SubmissionRow): EzSaveSubmissionRecord {
  return {
    id: row.id,
    receiptToken: row.receipt_token,
    status: row.status,
    signerName: row.signer_name,
    signerEmail: row.signer_email,
    consentText: row.consent_text,
    consentVersion: row.consent_version,
    signedAt: row.signed_at?.toISOString() ?? null,
    faxNumber: row.fax_number,
    faxProvider: row.fax_provider,
    faxConfirmationId: row.fax_confirmation_id,
    faxStatusDetail: row.fax_status_detail,
    pdfSha256: row.pdf_sha256,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function postgresEnabled() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function pdfSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function createReceiptToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function createEzSaveSubmission(params: {
  signerName: string;
  signerEmail?: string | null;
  signedPdf: Uint8Array;
  faxProvider?: string | null;
  faxNumber?: string;
}): Promise<EzSaveSubmissionRecord | null> {
  if (!postgresEnabled()) return null;

  const sql = getSql();
  await ensureSchema(sql);
  const [row] = await sql<SubmissionRow[]>`
    INSERT INTO ez_save_submissions (
      id,
      receipt_token,
      status,
      signer_name,
      signer_email,
      consent_text,
      consent_version,
      signed_at,
      fax_number,
      fax_provider,
      pdf_sha256,
      signed_pdf
    )
    VALUES (
      ${randomUUID()},
      ${createReceiptToken()},
      ${"fax_pending"},
      ${params.signerName},
      ${params.signerEmail?.trim() || null},
      ${LADWP_EZ_SAVE_CONSENT_TEXT},
      ${LADWP_EZ_SAVE_CONSENT_VERSION},
      now(),
      ${params.faxNumber ?? LADWP_EZ_SAVE_WORKFLOW.faxNumber},
      ${params.faxProvider ?? null},
      ${pdfSha256(params.signedPdf)},
      ${Buffer.from(params.signedPdf)}
    )
    RETURNING id, receipt_token, status, signer_name, signer_email, consent_text,
      consent_version, signed_at, fax_number, fax_provider, fax_confirmation_id,
      fax_status_detail, pdf_sha256, created_at, updated_at
  `;
  return rowToRecord(row);
}

export async function updateEzSaveSubmissionFaxStatus(
  id: string,
  update:
    | { status: "fax_sent"; confirmationId: string; detail: string }
    | { status: "fax_failed"; detail: string },
): Promise<EzSaveSubmissionRecord | null> {
  if (!postgresEnabled()) return null;

  const sql = getSql();
  await ensureSchema(sql);
  const [row] =
    update.status === "fax_sent"
      ? await sql<SubmissionRow[]>`
          UPDATE ez_save_submissions
          SET status = ${update.status},
              fax_confirmation_id = ${update.confirmationId},
              fax_status_detail = ${update.detail},
              updated_at = now()
          WHERE id = ${id}
          RETURNING id, receipt_token, status, signer_name, signer_email, consent_text,
            consent_version, signed_at, fax_number, fax_provider, fax_confirmation_id,
            fax_status_detail, pdf_sha256, created_at, updated_at
        `
      : await sql<SubmissionRow[]>`
          UPDATE ez_save_submissions
          SET status = ${update.status},
              fax_status_detail = ${update.detail},
              updated_at = now()
          WHERE id = ${id}
          RETURNING id, receipt_token, status, signer_name, signer_email, consent_text,
            consent_version, signed_at, fax_number, fax_provider, fax_confirmation_id,
            fax_status_detail, pdf_sha256, created_at, updated_at
        `;

  return row ? rowToRecord(row) : null;
}

export async function getEzSaveSubmissionByReceiptToken(
  receiptToken: string,
): Promise<EzSaveSubmissionRecord | null> {
  if (!postgresEnabled()) return null;

  const sql = getSql();
  await ensureSchema(sql);
  const [row] = await sql<SubmissionRow[]>`
    SELECT id, receipt_token, status, signer_name, signer_email, consent_text,
      consent_version, signed_at, fax_number, fax_provider, fax_confirmation_id,
      fax_status_detail, pdf_sha256, created_at, updated_at
    FROM ez_save_submissions
    WHERE receipt_token = ${receiptToken}
  `;
  return row ? rowToRecord(row) : null;
}
