"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import {
  LADWP_EZ_SAVE_FIELDS,
  LADWP_EZ_SAVE_WORKFLOW,
} from "@/programs/ladwp_ez_save/workflow";
import type {
  LadwpEzSaveApplicationDraft,
  LadwpEzSaveDraftField,
  LadwpEzSaveEligibilityResult,
  LadwpEzSaveInput,
} from "@/programs/ladwp_ez_save/types";

type Step = "landing" | "form" | "result" | "review" | "handoff";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(formData: FormData, key: string) {
  const value = Number(formData.get(key));
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function booleanValue(formData: FormData, key: string) {
  const value = formData.get(key);
  if (value === "yes" || value === "true" || value === "on") return true;
  if (value === "no" || value === "false") return false;
  return undefined;
}

function statusTitle(status: LadwpEzSaveEligibilityResult["status"]) {
  switch (status) {
    case "SUPPORTED_LIKELY_ELIGIBLE":
      return "Likely eligible for EZ-SAVE";
    case "SUPPORTED_POSSIBLY_ELIGIBLE_NEEDS_REVIEW":
      return "Possibly eligible, needs review";
    case "SUPPORTED_UNLIKELY_ELIGIBLE":
      return "Probably not eligible";
    case "UNSUPPORTED_NOT_LADWP":
      return "LADWP customers only";
    case "UNSUPPORTED_NOT_CUSTOMER_OF_RECORD":
      return "Customer of record needs review";
    case "UNSUPPORTED_NOT_PRIMARY_RESIDENCE":
      return "Primary residence required";
    case "UNSUPPORTED_DEPENDENT":
      return "Dependent status needs review";
  }
}

function fieldDefinition(fieldKey: string) {
  return LADWP_EZ_SAVE_FIELDS.find((field) => field.fieldKey === fieldKey);
}

function formatValue(value: LadwpEzSaveDraftField["value"] | undefined) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function apiError(value: unknown): string | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  ) {
    return value.error;
  }
  return null;
}

export function LadwpEzSaveFlow() {
  const [step, setStep] = useState<Step>("landing");
  const [result, setResult] = useState<LadwpEzSaveEligibilityResult | null>(null);
  const [draft, setDraft] = useState<LadwpEzSaveApplicationDraft | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [pdfStatus, setPdfStatus] = useState("");
  const formRef = useRef<HTMLDivElement>(null);

  function start() {
    setStep("form");
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function collectPayload(formData: FormData): Partial<LadwpEzSaveInput> {
    const includeAccountNumber = booleanValue(
      formData,
      "includeAccountNumberInDraft",
    );

    return {
      utilityProvider: String(formData.get("utilityProvider") ?? "LADWP"),
      isLadwpCustomer: booleanValue(formData, "isLadwpCustomer"),
      zipCode: textValue(formData, "zipCode"),
      firstName: textValue(formData, "firstName"),
      lastName: textValue(formData, "lastName"),
      middleInitial: textValue(formData, "middleInitial"),
      serviceAddressStreetNumber: textValue(
        formData,
        "serviceAddressStreetNumber",
      ),
      serviceAddressStreetName: textValue(formData, "serviceAddressStreetName"),
      apartmentNumber: textValue(formData, "apartmentNumber"),
      phone: textValue(formData, "phone"),
      mobilePhone: textValue(formData, "mobilePhone"),
      householdTotal: numberValue(formData, "householdTotal"),
      householdAdults: numberValue(formData, "householdAdults"),
      householdChildren: numberValue(formData, "householdChildren"),
      annualGrossHouseholdIncome: numberValue(
        formData,
        "annualGrossHouseholdIncome",
      ),
      isCustomerOfRecord: booleanValue(formData, "isCustomerOfRecord"),
      isPrimaryResidence: booleanValue(formData, "isPrimaryResidence"),
      claimedAsDependent: booleanValue(formData, "claimedAsDependent"),
      newApplicationOrRenewal:
        formData.get("newApplicationOrRenewal") === "renewal"
          ? "renewal"
          : "new_application",
      consentToPrepareApplication: booleanValue(
        formData,
        "consentToPrepareApplication",
      ),
      userCertifiesReviewRequired: booleanValue(
        formData,
        "userCertifiesReviewRequired",
      ),
      email: textValue(formData, "email"),
      includeAccountNumberInDraft: includeAccountNumber,
      accountNumber: includeAccountNumber
        ? textValue(formData, "accountNumber")
        : undefined,
      monthlyBillAmount: numberValue(formData, "monthlyBillAmount"),
      pastDueStatus: booleanValue(formData, "pastDueStatus"),
      consentToContact: booleanValue(formData, "consentToContact"),
    };
  }

  async function submitCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("Checking EZ-SAVE…");
    const payload = collectPayload(new FormData(event.currentTarget));

    try {
      const checkResponse = await fetch("/api/programs/ladwp-ez-save/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const checkJson = (await checkResponse.json()) as
        | LadwpEzSaveEligibilityResult
        | { error?: string };

      const checkError = apiError(checkJson);
      if (!checkResponse.ok || checkError) {
        setStatus(checkError ?? "Could not check EZ-SAVE right now.");
        return;
      }

      const draftResponse = await fetch("/api/programs/ladwp-ez-save/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const draftJson = (await draftResponse.json()) as
        | LadwpEzSaveApplicationDraft
        | { error?: string };

      const draftError = apiError(draftJson);
      if (!draftResponse.ok || draftError) {
        setStatus(draftError ?? "Could not prepare your draft right now.");
        return;
      }

      const checkedResult = checkJson as LadwpEzSaveEligibilityResult;
      const preparedDraft = draftJson as LadwpEzSaveApplicationDraft;
      setResult(checkedResult);
      setDraft(preparedDraft);
      setDraftValues(
        Object.fromEntries(
          preparedDraft.fields.map((field) => [
            field.fieldKey,
            formatValue(field.value),
          ]),
        ),
      );
      setStep("result");
      setStatus("");
    } catch {
      setStatus("Network error. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  const copiedAnswers = useMemo(() => {
    if (!draft) return "";
    return LADWP_EZ_SAVE_FIELDS.map((field) => {
      const value = draftValues[field.fieldKey] || "";
      return `${field.label}: ${value || "[missing]"}`;
    }).join("\n");
  }, [draft, draftValues]);

  async function copyAnswers() {
    await navigator.clipboard.writeText(copiedAnswers);
    setStatus("Answers copied.");
  }

  async function tryPdf() {
    setPdfStatus("Checking PDF generation…");
    const response = await fetch("/api/programs/ladwp-ez-save/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const json = (await response.json()) as { reason?: string };
    setPdfStatus(json.reason ?? "PDF generation is not available yet.");
  }

  return (
    <main className="container utility-page">
      <section className="utility-landing" aria-labelledby="ladwp-title">
        <div className="utility-landing__copy">
          <p className="kicker">LADWP EZ-SAVE</p>
          <h1 id="ladwp-title">Check if you qualify for a lower LADWP bill</h1>
          <p className="muted lead">
            Answer a few questions or upload your LADWP bill. We&apos;ll check
            EZ-SAVE eligibility and prepare your application draft.
          </p>
          <button className="button button--emphasis" type="button" onClick={start}>
            Start my check
          </button>
          <p className="muted utility-fineprint">
            No proof of income is needed to apply. You review everything before
            applying.
          </p>
        </div>
        <div className="utility-landing__panel" aria-label="EZ-SAVE summary">
          <span>lower my utility bill</span>
          <strong>EZ-SAVE</strong>
          <p>Application prep for income-qualified LADWP residential customers.</p>
        </div>
      </section>

      <div ref={formRef}>
        {step === "form" ? (
          <LadwpForm loading={loading} status={status} onSubmit={submitCheck} />
        ) : null}
        {step === "result" && result && draft ? (
          <ResultPanel
            result={result}
            draft={draft}
            onReview={() => setStep("review")}
            onReset={() => {
              setResult(null);
              setDraft(null);
              setStep("form");
            }}
          />
        ) : null}
        {step === "review" && result && draft ? (
          <ReviewPanel
            copiedAnswers={copiedAnswers}
            draft={draft}
            draftValues={draftValues}
            setDraftValues={setDraftValues}
            status={status}
            onBack={() => setStep("result")}
            onCopy={copyAnswers}
            onContinue={() => setStep("handoff")}
          />
        ) : null}
        {step === "handoff" && draft ? (
          <HandoffPanel
            pdfStatus={pdfStatus}
            onBack={() => setStep("review")}
            onPdf={tryPdf}
          />
        ) : null}
      </div>
    </main>
  );
}

function LadwpForm({
  loading,
  status,
  onSubmit,
}: {
  loading: boolean;
  status: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="utility-card" aria-labelledby="ladwp-form-title">
      <p className="kicker">application prep</p>
      <h1 id="ladwp-form-title">Get your EZ-SAVE application ready in minutes</h1>
      <p className="privacy-notice">
        We use this information to estimate EZ-SAVE eligibility and prepare your
        application draft. Review all answers before applying. Do not upload
        income documents or sensitive IDs.
      </p>

      <form className="utility-form" onSubmit={onSubmit}>
        <div className="utility-form__grid">
          <label>
            Utility provider
            <select name="utilityProvider" defaultValue="LADWP">
              <option value="LADWP">LADWP</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <SelectBoolean label="Are you an LADWP customer?" name="isLadwpCustomer" />
          <label>
            ZIP code
            <input inputMode="numeric" maxLength={5} name="zipCode" placeholder="90012" />
          </label>
          <label>
            First name
            <input autoComplete="given-name" name="firstName" placeholder="Maria" />
          </label>
          <label>
            Last name
            <input autoComplete="family-name" name="lastName" placeholder="Garcia" />
          </label>
          <label>
            Middle initial
            <input maxLength={1} name="middleInitial" placeholder="A" />
          </label>
          <label>
            Street number
            <input name="serviceAddressStreetNumber" placeholder="123" />
          </label>
          <label>
            Street name
            <input name="serviceAddressStreetName" placeholder="Spring St" />
          </label>
          <label>
            Apartment number
            <input name="apartmentNumber" placeholder="4B" />
          </label>
          <label>
            Home telephone
            <input inputMode="tel" name="phone" placeholder="213-555-0100" />
          </label>
          <label>
            Mobile telephone
            <input inputMode="tel" name="mobilePhone" placeholder="323-555-0100" />
          </label>
          <label>
            Household total
            <input min={1} name="householdTotal" type="number" />
          </label>
          <label>
            Adults
            <input min={0} name="householdAdults" type="number" />
          </label>
          <label>
            Children
            <input min={0} name="householdChildren" type="number" />
          </label>
          <label>
            Combined gross annual household income
            <input min={0} name="annualGrossHouseholdIncome" type="number" />
          </label>
          <SelectBoolean label="Are you the LADWP customer of record?" name="isCustomerOfRecord" />
          <SelectBoolean label="Is this your permanent primary residence?" name="isPrimaryResidence" />
          <SelectBoolean label="Can someone claim you as a dependent?" name="claimedAsDependent" />
          <label>
            Application type
            <select name="newApplicationOrRenewal" defaultValue="new_application">
              <option value="new_application">New application</option>
              <option value="renewal">Renewal</option>
            </select>
          </label>
          <label>
            Email for reminders
            <input autoComplete="email" name="email" type="email" placeholder="you@example.com" />
          </label>
          <label>
            Monthly bill amount
            <input min={0} name="monthlyBillAmount" type="number" />
          </label>
          <SelectBoolean label="Is the bill past due?" name="pastDueStatus" optional />
        </div>

        <fieldset className="utility-programs">
          <legend>Optional bill details</legend>
          <p className="muted utility-fineprint">
            Only enter your LADWP account number if you want it included in your
            application draft. We do not need your SSN.
          </p>
          <label className="toggle-field">
            <input name="includeAccountNumberInDraft" type="checkbox" />
            <span>Include account number in my draft</span>
          </label>
          <label>
            Account number
            <input name="accountNumber" placeholder="Only if you choose to include it" />
          </label>
          <label>
            Bill upload
            <input accept=".pdf,image/*" disabled name="billUpload" type="file" />
            <span className="muted utility-fineprint">
              Upload parsing is a future step. You can finish with manual entry now.
            </span>
          </label>
        </fieldset>

        <fieldset className="utility-programs">
          <legend>Review and contact</legend>
          <label className="toggle-field">
            <input name="consentToPrepareApplication" required type="checkbox" />
            <span>I want this app to prepare an EZ-SAVE application draft.</span>
          </label>
          <label className="toggle-field">
            <input name="userCertifiesReviewRequired" required type="checkbox" />
            <span>I understand I must review answers before applying.</span>
          </label>
          <label className="toggle-field">
            <input name="consentToContact" type="checkbox" />
            <span>Email me my application draft or remind me to check my next LADWP bill.</span>
          </label>
        </fieldset>

        <div className="row">
          <button className="button" disabled={loading} type="submit">
            {loading ? "Checking…" : "Check and prepare draft"}
          </button>
          {status ? <p className="muted">{status}</p> : null}
        </div>
      </form>
    </section>
  );
}

function SelectBoolean({
  label,
  name,
  optional = false,
}: {
  label: string;
  name: string;
  optional?: boolean;
}) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={optional ? "" : "yes"}>
        {optional ? <option value="">Not sure</option> : null}
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </label>
  );
}

function ResultPanel({
  result,
  draft,
  onReview,
  onReset,
}: {
  result: LadwpEzSaveEligibilityResult;
  draft: LadwpEzSaveApplicationDraft;
  onReview: () => void;
  onReset: () => void;
}) {
  return (
    <section className="utility-result">
      <div className="utility-result__header">
        <p className="kicker">{result.confidence.toLowerCase()} estimate</p>
        <h1>{statusTitle(result.status)}</h1>
        <p className="muted lead">
          {LADWP_EZ_SAVE_WORKFLOW.resultLanguageTemplates.noIncomeProof}
        </p>
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
            {draft.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </section>
      </div>
      <p className="privacy-notice">
        Review these answers before applying. This app does not guarantee
        approval.
      </p>
      <div className="row">
        <button className="button" type="button" onClick={onReview}>
          Review application draft
        </button>
        <button className="button secondary" type="button" onClick={onReset}>
          Edit answers
        </button>
      </div>
    </section>
  );
}

function ReviewPanel({
  draft,
  draftValues,
  copiedAnswers,
  status,
  setDraftValues,
  onBack,
  onCopy,
  onContinue,
}: {
  draft: LadwpEzSaveApplicationDraft;
  draftValues: Record<string, string>;
  copiedAnswers: string;
  status: string;
  setDraftValues: Dispatch<SetStateAction<Record<string, string>>>;
  onBack: () => void;
  onCopy: () => void;
  onContinue: () => void;
}) {
  const fieldsByKey = new Map(draft.fields.map((field) => [field.fieldKey, field]));
  const missing = draft.missingFields
    .map((fieldKey) => fieldDefinition(fieldKey)?.label ?? fieldKey)
    .join(", ");

  return (
    <section className="utility-result utility-draft">
      <div className="utility-result__header">
        <p className="kicker">review before ladwp</p>
        <h1>Application draft</h1>
        <p className="muted lead">
          Review these answers before applying. This app does not guarantee
          approval.
        </p>
      </div>
      {missing ? (
        <p className="privacy-notice">
          <strong>Missing fields:</strong> {missing}
        </p>
      ) : null}
      <div className="utility-draft__rows">
        {LADWP_EZ_SAVE_FIELDS.map((definition) => {
          const field = fieldsByKey.get(definition.fieldKey);
          const value = draftValues[definition.fieldKey] ?? "";
          return (
            <div className="utility-draft-row" key={definition.fieldKey}>
              <div className="utility-draft-row__meta">
                <strong>
                  {definition.label}
                  {definition.required ? " *" : ""}
                </strong>
                <span>{definition.userHelpText}</span>
              </div>
              <div className="utility-draft-row__control">
                <input
                  value={value}
                  onChange={(event) =>
                    setDraftValues((current) => ({
                      ...current,
                      [definition.fieldKey]: event.currentTarget.value,
                    }))
                  }
                />
              </div>
              <div className="utility-draft-row__status">
                <span>Source: {field?.source.replace("_", " ") ?? "missing"}</span>
                <span>Confidence: {field?.confidence ?? "needs answer"}</span>
                <span>Required: {definition.required ? "yes" : "no"}</span>
                <span>Review: {!field || field.needsReview ? "needed" : "ok"}</span>
              </div>
            </div>
          );
        })}
      </div>
      <section className="utility-result__section">
        <h2>Warnings</h2>
        <ul className="utility-list">
          {draft.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </section>
      <div className="row">
        <button className="button" type="button" onClick={onCopy}>
          Copy all answers
        </button>
        <button className="button secondary" type="button" onClick={onContinue}>
          Continue to LADWP
        </button>
        <button className="button secondary" type="button" onClick={onBack}>
          Back
        </button>
        {status ? <p className="muted">{status}</p> : null}
      </div>
      <textarea
        aria-label="Copied answers preview"
        className="utility-copy-preview"
        readOnly
        value={copiedAnswers}
      />
    </section>
  );
}

function HandoffPanel({
  pdfStatus,
  onBack,
  onPdf,
}: {
  pdfStatus: string;
  onBack: () => void;
  onPdf: () => void;
}) {
  return (
    <section className="utility-result">
      <div className="utility-result__header">
        <p className="kicker">submission handoff</p>
        <h1>Your draft is ready</h1>
        <p className="muted lead">
          Review each answer, then continue to LADWP or download the filled
          application packet when PDF generation is enabled.
        </p>
      </div>
      <div className="utility-result__grid">
        <section className="utility-result__section">
          <h2>Online application</h2>
          <p className="muted">Fastest if you have an LADWP online account.</p>
          <a
            className="button"
            href={LADWP_EZ_SAVE_WORKFLOW.applicationUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open LADWP application
          </a>
        </section>
        <section className="utility-result__section">
          <h2>Filled PDF packet</h2>
          <p className="muted">
            Download your completed draft. Review it, sign it, then submit to
            LADWP.
          </p>
          <button className="button secondary" type="button" onClick={onPdf}>
            Download filled EZ-SAVE PDF
          </button>
          {pdfStatus ? <p className="muted">{pdfStatus}</p> : null}
        </section>
        <section className="utility-result__section">
          <h2>Mail or fax</h2>
          <p className="muted">
            Only use this after reviewing and signing your application.
          </p>
          <p className="muted">Fax: {LADWP_EZ_SAVE_WORKFLOW.faxNumber}</p>
          <address className="utility-address">
            {LADWP_EZ_SAVE_WORKFLOW.mailAddress.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </address>
        </section>
      </div>
      <div className="row">
        <button className="button secondary" type="button" onClick={onBack}>
          Back to review
        </button>
      </div>
    </section>
  );
}
