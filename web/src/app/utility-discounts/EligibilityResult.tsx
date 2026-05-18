import type { EligibilityResult as EligibilityResultType } from "@/lib/utility-discounts/types";
import { PGE_CARE_FERA_WORKFLOW } from "@/programs/pge_care_fera/workflow";

import { ProgramChecklist } from "./ProgramChecklist";

type Props = {
  result: EligibilityResultType;
  draftLoading: boolean;
  draftStatus: string;
  onPrepareDraft: () => void;
  onReset: () => void;
};

const resultCopy: Record<string, string> = {
  CARE: "Likely CARE eligible",
  FERA: "Likely FERA eligible",
  REVIEW: "Possibly eligible, needs review",
  NONE: "Probably not eligible",
};

export function EligibilityResult({
  result,
  draftLoading,
  draftStatus,
  onPrepareDraft,
  onReset,
}: Props) {
  const title = result.supported
    ? resultCopy[result.program]
    : "Not supported yet";
  const discount =
    result.program === "CARE"
      ? "CARE is generally a monthly discount on PG&E gas and electric bills."
      : result.program === "FERA"
        ? "FERA is generally a monthly electric bill discount for income-qualified households."
        : "This checkup does not estimate guaranteed dollar savings.";

  return (
    <section className="utility-result" aria-live="polite">
      <div className="utility-result__header">
        <p className="kicker">{result.confidence.toLowerCase()} estimate</p>
        <h1>{title}</h1>
        <p className="muted lead">{discount}</p>
      </div>

      <div className="utility-result__grid">
        <section className="utility-result__section">
          <h2>Why this result</h2>
          <ul className="utility-list">
            {result.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </section>

        <section className="utility-result__section">
          <h2>Next step</h2>
          <ul className="utility-list">
            {result.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
          {result.supported ? (
            <a
              className="button utility-result__apply"
              href={PGE_CARE_FERA_WORKFLOW.applicationUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open PG&amp;E application
            </a>
          ) : null}
        </section>
      </div>

      {result.supported ? <ProgramChecklist program={result.program} /> : null}

      <p className="privacy-notice">{result.disclaimer}</p>
      <div className="row">
        {result.supported ? (
          <button
            className="button"
            disabled={draftLoading}
            type="button"
            onClick={onPrepareDraft}
          >
            {draftLoading ? "Preparing…" : "Prepare application draft"}
          </button>
        ) : null}
        <button className="button secondary" type="button" onClick={onReset}>
          Check again
        </button>
        {draftStatus ? <p className="muted">{draftStatus}</p> : null}
      </div>
    </section>
  );
}
