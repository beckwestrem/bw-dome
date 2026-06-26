import Link from "next/link";
import { notFound } from "next/navigation";

import { getEzSaveSubmissionByReceiptToken } from "@/programs/ladwp_ez_save/submission-store";

function statusLabel(status: string) {
  switch (status) {
    case "fax_sent":
      return "Fax sent";
    case "fax_pending":
      return "Fax pending";
    case "fax_failed":
      return "Fax needs attention";
    case "signed":
      return "Signed";
    default:
      return status;
  }
}

export default async function EzSaveReceiptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const submission = await getEzSaveSubmissionByReceiptToken(token);

  if (!submission) notFound();

  return (
    <main className="container">
      <section className="utility-result">
        <div className="utility-result__header">
          <p className="kicker">EZ-SAVE receipt</p>
          <h1>{statusLabel(submission.status)}</h1>
          <p className="muted lead">
            Keep this page for your records. It does not require an account.
          </p>
        </div>

        <div className="utility-result__grid">
          <section className="utility-result__section">
            <h2>Delivery</h2>
            <p className="muted">Fax: {submission.faxNumber}</p>
            {submission.faxConfirmationId ? (
              <p className="muted">Confirmation: {submission.faxConfirmationId}</p>
            ) : null}
            {submission.faxStatusDetail ? (
              <p className="muted">{submission.faxStatusDetail}</p>
            ) : null}
          </section>

          <section className="utility-result__section">
            <h2>Signature</h2>
            <p className="muted">Signer: {submission.signerName ?? "Not recorded"}</p>
            <p className="muted">
              Signed:{" "}
              {submission.signedAt
                ? new Date(submission.signedAt).toLocaleString()
                : "Not recorded"}
            </p>
            <p className="muted">Consent version: {submission.consentVersion}</p>
          </section>

          <section className="utility-result__section">
            <h2>Record</h2>
            <p className="muted">Receipt token: {submission.receiptToken}</p>
            {submission.pdfSha256 ? (
              <p className="muted utility-hash">PDF hash: {submission.pdfSha256}</p>
            ) : null}
          </section>
        </div>

        <div className="row">
          <Link className="button secondary" href="/">
            Home
          </Link>
          <Link className="button secondary" href="/utility-discounts">
            Start another application
          </Link>
        </div>
      </section>
    </main>
  );
}
