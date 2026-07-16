import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Clock3, TriangleAlert } from "lucide-react";

import { EzBrand } from "@/app/components/EzUi";
import { getEzSaveSubmissionByReceiptToken } from "@/programs/ladwp_ez_save/submission-store";

function receiptContent(status: string) {
  switch (status) {
    case "fax_sent":
      return { tone: "success", title: "Application faxed to LADWP", description: "Your signed application was transmitted to LADWP." };
    case "fax_failed":
      return { tone: "error", title: "Fax needs attention", description: "The fax was not completed. Keep this receipt and try again." };
    case "fax_pending":
      return { tone: "pending", title: "Fax is processing", description: "Your signed application is being transmitted." };
    default:
      return { tone: "pending", title: "Application signed", description: "Your signed application record has been created." };
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

  const content = receiptContent(submission.status);
  const date = submission.signedAt
    ? new Date(submission.signedAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })
    : "Not recorded";

  return (
    <div className="ez-shell ez-receipt-shell">
      <header className="ez-app-nav"><div className="ez-container"><EzBrand /><span>Submission receipt</span></div></header>
      <main className="ez-receipt-main">
        <article className={`ez-receipt ez-receipt--${content.tone}`}>
          <div className="ez-receipt__icon" aria-hidden="true">{content.tone === "success" ? <Check size={27} /> : content.tone === "error" ? <TriangleAlert size={25} /> : <Clock3 size={25} />}</div>
          <p className="ez-kicker">EZ-SAVE receipt</p>
          <h1>{content.title}</h1>
          <p className="ez-receipt__lead">{content.description}</p>
          <p className="ez-receipt__disclaimer">This receipt confirms transmission. It does not mean LADWP has approved the application.</p>

          <dl className="ez-receipt__summary">
            <div><dt>Confirmation ID</dt><dd className="ez-mono">{submission.faxConfirmationId ?? "Pending"}</dd></div>
            <div><dt>Destination</dt><dd>{submission.faxNumber}</dd></div>
            <div><dt>Date and time</dt><dd>{date}</dd></div>
            <div><dt>Signer</dt><dd>{submission.signerName ?? "Not recorded"}</dd></div>
          </dl>

          {submission.faxStatusDetail ? <p className="ez-receipt__status">{submission.faxStatusDetail}</p> : null}

          <details className="ez-technical-details">
            <summary>Technical receipt details</summary>
            <dl>
              <div><dt>Receipt token</dt><dd className="ez-mono">{submission.receiptToken}</dd></div>
              <div><dt>Consent version</dt><dd className="ez-mono">{submission.consentVersion}</dd></div>
              {submission.pdfSha256 ? <div><dt>PDF hash</dt><dd className="ez-mono ez-break-all">{submission.pdfSha256}</dd></div> : null}
            </dl>
          </details>

          <div className="ez-receipt__actions">
            <Link className="ez-button" href="/utility-discounts">Start another application</Link>
            <Link className="ez-button ez-button--secondary" href="/">Back to Buffalo Billsaver</Link>
          </div>
        </article>
      </main>
    </div>
  );
}
