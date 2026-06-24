"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import {
  LADWP_EZ_SAVE_FIELDS,
  LADWP_EZ_SAVE_WORKFLOW,
} from "@/programs/ladwp_ez_save/workflow";
import type {
  LadwpEzSaveApplicationDraft,
  LadwpEzSaveBillExtractedField,
  LadwpEzSaveBillExtractionResult,
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

function parseDraftValue(
  rawValue: string,
  definition: (typeof LADWP_EZ_SAVE_FIELDS)[number],
): LadwpEzSaveDraftField["value"] | undefined {
  const value = rawValue.trim();
  if (!value) return undefined;

  if (definition.type === "number") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : value;
  }

  if (definition.type === "boolean") {
    const normalized = value.toLowerCase();
    if (["yes", "true", "y"].includes(normalized)) return true;
    if (["no", "false", "n"].includes(normalized)) return false;
  }

  return value;
}

function draftWithReviewedValues(
  draft: LadwpEzSaveApplicationDraft,
  draftValues: Record<string, string>,
): LadwpEzSaveApplicationDraft {
  const originalFields = new Map(draft.fields.map((field) => [field.fieldKey, field]));
  const fields: LadwpEzSaveDraftField[] = [];
  const missingFields: string[] = [];

  for (const definition of LADWP_EZ_SAVE_FIELDS) {
    const value = parseDraftValue(draftValues[definition.fieldKey] ?? "", definition);
    if (value === undefined) {
      if (definition.required) missingFields.push(definition.fieldKey);
      continue;
    }

    const original = originalFields.get(definition.fieldKey);
    fields.push({
      fieldKey: definition.fieldKey,
      label: definition.label,
      value,
      source: original?.source ?? "manual_edit",
      confidence: original?.confidence ?? "medium",
      needsReview: original?.needsReview ?? true,
      required: definition.required,
    });
  }

  return { ...draft, fields, missingFields };
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

const extractableInputNames: Partial<Record<keyof LadwpEzSaveInput, string>> = {
  utilityProvider: "utilityProvider",
  isLadwpCustomer: "isLadwpCustomer",
  zipCode: "zipCode",
  firstName: "firstName",
  lastName: "lastName",
  middleInitial: "middleInitial",
  serviceAddressStreetNumber: "serviceAddressStreetNumber",
  serviceAddressStreetName: "serviceAddressStreetName",
  apartmentNumber: "apartmentNumber",
  phone: "phone",
  mobilePhone: "mobilePhone",
  accountNumber: "accountNumber",
  monthlyBillAmount: "monthlyBillAmount",
  pastDueStatus: "pastDueStatus",
};

function setFormControlValue(form: HTMLFormElement, name: string, value: string) {
  const control = form.elements.namedItem(name);
  if (!control) return;

  if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement) {
    control.value = value;
  }
}

function formatExtractedFieldValue(field: LadwpEzSaveBillExtractedField) {
  if (typeof field.value === "boolean") return field.value ? "yes" : "no";
  return String(field.value);
}

function applyExtractedFieldsToForm(
  form: HTMLFormElement,
  fields: LadwpEzSaveBillExtractedField[],
) {
  let applied = 0;
  for (const field of fields) {
    const name = extractableInputNames[field.fieldKey];
    if (!name) continue;
    setFormControlValue(form, name, formatExtractedFieldValue(field));
    applied += 1;

    if (field.fieldKey === "accountNumber") {
      const includeAccount = form.elements.namedItem("includeAccountNumberInDraft");
      if (includeAccount instanceof HTMLInputElement) {
        includeAccount.checked = true;
      }
    }
  }
  return applied;
}

export function LadwpEzSaveFlow() {
  const [step, setStep] = useState<Step>("landing");
  const [result, setResult] = useState<LadwpEzSaveEligibilityResult | null>(null);
  const [draft, setDraft] = useState<LadwpEzSaveApplicationDraft | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [pdfStatus, setPdfStatus] = useState("");
  const [submissionStatus, setSubmissionStatus] = useState("");
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

  async function downloadPdfForDraft(
    reviewedDraft: LadwpEzSaveApplicationDraft,
    successMessage: string,
  ) {
    const response = await fetch("/api/programs/ladwp-ez-save/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reviewedDraft),
    });
    if (!response.ok) {
      const json = (await response.json()) as { reason?: string };
      setPdfStatus(json.reason ?? "PDF generation is not available yet.");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ladwp-ez-save-application-draft.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setPdfStatus(successMessage);
    return true;
  }

  async function tryPdf() {
    if (!draft) return;
    setPdfStatus("Preparing PDF...");
    setSubmissionStatus("");
    const reviewedDraft = draftWithReviewedValues(draft, draftValues);
    await downloadPdfForDraft(
      reviewedDraft,
      "PDF downloaded. Review it, sign it, then submit to LADWP.",
    );
  }

  async function tryFax() {
    if (!draft) return;
    const reviewedDraft = draftWithReviewedValues(draft, draftValues);
    setPdfStatus("");
    setSubmissionStatus("Preparing fax...");
    const response = await fetch("/api/programs/ladwp-ez-save/submit/fax", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reviewedDraft),
    });
    const json = (await response.json()) as {
      ok?: boolean;
      message?: string;
      reason?: string;
      confirmationId?: string;
      faxNumber?: string;
    };

    if (!response.ok || !json.ok) {
      setSubmissionStatus(
        json.reason ??
          `Fax is not configured yet. Download, sign, and fax the PDF to ${LADWP_EZ_SAVE_WORKFLOW.faxNumber}.`,
      );
      return;
    }

    setSubmissionStatus(
      `${json.message ?? "Fax submitted."} Confirmation: ${
        json.confirmationId ?? "submitted"
      }.`,
    );
  }

  async function tryEmailDraft() {
    if (!draft) return;
    const reviewedDraft = draftWithReviewedValues(draft, draftValues);
    setPdfStatus("");
    setSubmissionStatus("Preparing email draft...");
    const response = await fetch(
      "/api/programs/ladwp-ez-save/submit/email-draft",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewedDraft),
      },
    );
    const json = (await response.json()) as {
      mailtoHref?: string;
      attachmentReminder?: string;
      officialSubmissionNote?: string;
      error?: string;
    };

    if (!response.ok || !json.mailtoHref) {
      setSubmissionStatus(json.error ?? "Could not prepare the email draft.");
      return;
    }

    const downloaded = await downloadPdfForDraft(
      reviewedDraft,
      "PDF downloaded for email attachment.",
    );
    if (!downloaded) return;

    window.location.href = json.mailtoHref;
    setSubmissionStatus(
      `${json.attachmentReminder ?? "Attach the signed PDF before sending."} ${
        json.officialSubmissionNote ?? ""
      }`,
    );
  }

  return (
    <main className="container utility-page">
      {step === "landing" ? (
        <section className="utility-landing" aria-labelledby="ladwp-title">
          <div className="utility-landing__copy">
            <p className="kicker">LADWP EZ-SAVE</p>
            <h1 id="ladwp-title">Check if you qualify for a lower LADWP bill</h1>
            <p className="muted lead">
              EZ-SAVE is LADWP&apos;s income-qualified discount program for
              residential customers. If you qualify, it can reduce your utility
              costs and make it easier to keep your account current.
            </p>
            <ul className="utility-list utility-landing__list">
              <li>No proof of income is needed with the application.</li>
              <li>We prepare a filled application draft for you to review.</li>
              <li>You choose whether to download, fax, mail, or apply online.</li>
            </ul>
            <button className="button button--emphasis" type="button" onClick={start}>
              Start my check
            </button>
            <p className="muted utility-fineprint">
              This tool does not guarantee approval. If your bill is already
              past due, LADWP may have separate payment assistance options.
            </p>
          </div>
          <div className="utility-landing__panel" aria-label="EZ-SAVE summary">
            <span>lower my utility bill</span>
            <strong>EZ-SAVE</strong>
            <p>Application prep for income-qualified LADWP residential customers.</p>
          </div>
        </section>
      ) : null}

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
            submissionStatus={submissionStatus}
            onBack={() => setStep("review")}
            onEmailDraft={tryEmailDraft}
            onFax={tryFax}
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
  const [extractStatus, setExtractStatus] = useState("");
  const [extractWarnings, setExtractWarnings] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const formElementRef = useRef<HTMLFormElement>(null);

  async function handleBillUpload(file: File | undefined) {
    if (!file || !formElementRef.current) return;
    setExtracting(true);
    setExtractWarnings([]);
    setExtractStatus("Reading bill...");

    const body = new FormData();
    body.append("bill", file);

    try {
      const response = await fetch("/api/programs/ladwp-ez-save/bill-extract", {
        method: "POST",
        body,
      });
      const json = (await response.json()) as
        | LadwpEzSaveBillExtractionResult
        | { error?: string };

      const error = apiError(json);
      if (!response.ok || error) {
        setExtractStatus(error ?? "Could not read that bill.");
        return;
      }

      const result = json as LadwpEzSaveBillExtractionResult;
      const applied = applyExtractedFieldsToForm(formElementRef.current, result.fields);
      setExtractWarnings(result.warnings);
      setExtractStatus(
        applied > 0
          ? `Prefilled ${applied} field${applied === 1 ? "" : "s"}. Review before continuing.`
          : "No fields were prefilled. You can continue manually.",
      );
    } catch {
      setExtractStatus("Could not read that bill. You can continue manually.");
    } finally {
      setExtracting(false);
    }
  }

  return (
    <section className="utility-card" aria-labelledby="ladwp-form-title">
      <p className="kicker">application prep</p>
      <h1 id="ladwp-form-title">Get your EZ-SAVE application ready</h1>
      <div className="utility-form-intro">
        <p>
          EZ-SAVE helps eligible LADWP households lower their utility bill. We
          only ask for the details LADWP needs to estimate eligibility and build
          the application draft.
        </p>
        <p>
          You can type everything yourself or upload a bill to prefill simple
          account details. Either way, you review every answer before applying.
        </p>
      </div>
      <p className="privacy-notice">
        Do not upload income documents, IDs, SSNs, bank information, or medical
        records. No proof of income is needed with the EZ-SAVE application.
      </p>

      <form className="utility-form" ref={formElementRef} onSubmit={onSubmit}>
        <div className="utility-form__grid">
          <label>
            Utility provider
            <select name="utilityProvider" defaultValue="LADWP">
              <option value="LADWP">LADWP</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <SelectBoolean
            hint="Choose yes if this is an LADWP residential account for your home."
            label="Are you an LADWP customer?"
            name="isLadwpCustomer"
          />
          <label>
            ZIP code
            <input inputMode="numeric" maxLength={5} name="zipCode" placeholder="90012" />
            <span className="muted utility-field-help">
              Use the ZIP code for the LADWP service address, not a mailing
              address.
            </span>
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
            <span className="muted utility-field-help">
              Count everyone who lives in the home, including children.
            </span>
          </label>
          <label>
            Adults
            <input min={0} name="householdAdults" type="number" />
            <span className="muted utility-field-help">
              Adults are household members age 18 or older.
            </span>
          </label>
          <label>
            Children
            <input min={0} name="householdChildren" type="number" />
            <span className="muted utility-field-help">
              Children are household members under age 18.
            </span>
          </label>
          <label>
            Combined gross annual household income
            <input min={0} name="annualGrossHouseholdIncome" type="number" />
            <span className="muted utility-field-help">
              Enter yearly income before taxes for everyone in the household.
            </span>
          </label>
          <SelectBoolean
            hint="This means your name is on the LADWP account or bill."
            label="Are you the LADWP customer of record?"
            name="isCustomerOfRecord"
          />
          <SelectBoolean
            hint="This should be the home where you live most of the time."
            label="Is this your permanent primary residence?"
            name="isPrimaryResidence"
          />
          <SelectBoolean
            hint="Answer yes if another person can list you as a dependent on their taxes."
            label="Can someone claim you as a dependent?"
            name="claimedAsDependent"
          />
          <label>
            Application type
            <select name="newApplicationOrRenewal" defaultValue="new_application">
              <option value="new_application">New application</option>
              <option value="renewal">Renewal</option>
            </select>
            <span className="muted utility-field-help">
              Choose renewal only if you are already enrolled and updating your
              EZ-SAVE status.
            </span>
          </label>
          <label>
            Email for reminders
            <input autoComplete="email" name="email" type="email" placeholder="you@example.com" />
          </label>
          <label>
            Monthly bill amount
            <input min={0} name="monthlyBillAmount" type="number" />
            <span className="muted utility-field-help">
              Optional. This helps estimate how meaningful a monthly discount
              could be for you.
            </span>
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
            <span className="muted utility-field-help">
              This is usually printed near the top of the LADWP bill. Leave it
              blank if you do not want it in the draft.
            </span>
          </label>
          <label>
            Bill upload
            <input
              accept=".pdf,image/*,.txt,.csv,text/plain,text/csv"
              name="billUpload"
              type="file"
              onChange={(event) =>
                handleBillUpload(event.currentTarget.files?.[0])
              }
            />
            <span className="muted utility-fineprint">
              Optional. Plain text bills can prefill fields now; PDF/image
              extraction can use an OCR or LLM provider later. Manual entry
              always works.
            </span>
          </label>
          {extractStatus ? (
            <p className="privacy-notice" aria-live="polite">
              {extracting ? "Reading bill..." : extractStatus}
            </p>
          ) : null}
          {extractWarnings.length > 0 ? (
            <ul className="utility-list utility-extract-warnings">
              {extractWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
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
  hint,
  label,
  name,
  optional = false,
}: {
  hint?: string;
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
      {hint ? <span className="muted utility-field-help">{hint}</span> : null}
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
  submissionStatus,
  onBack,
  onEmailDraft,
  onFax,
  onPdf,
}: {
  pdfStatus: string;
  submissionStatus: string;
  onBack: () => void;
  onEmailDraft: () => void;
  onFax: () => void;
  onPdf: () => void;
}) {
  return (
    <section className="utility-result">
      <div className="utility-result__header">
        <p className="kicker">submission handoff</p>
        <h1>Your draft is ready</h1>
        <p className="muted lead">
          Review each answer, then choose an official submission route. LADWP
          currently lists online, fax, and mail for this packet.
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
          <h2>Fax submission</h2>
          <p className="muted">
            Send the filled packet to LADWP&apos;s listed EZ-SAVE fax number
            when a fax provider is configured.
          </p>
          <p className="muted">Fax: {LADWP_EZ_SAVE_WORKFLOW.faxNumber}</p>
          <button className="button secondary" type="button" onClick={onFax}>
            Submit by fax
          </button>
        </section>
        <section className="utility-result__section">
          <h2>Email draft</h2>
          <p className="muted">
            Download the packet and open a prewritten email. Attach the signed
            PDF before sending.
          </p>
          <button className="button secondary" type="button" onClick={onEmailDraft}>
            Prepare email draft
          </button>
          <p className="muted">
            {LADWP_EZ_SAVE_WORKFLOW.emailSubmissionNote}
          </p>
        </section>
        <section className="utility-result__section">
          <h2>Mail</h2>
          <p className="muted">
            Print, sign, and mail the completed application packet.
          </p>
          <address className="utility-address">
            {LADWP_EZ_SAVE_WORKFLOW.mailAddress.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </address>
        </section>
      </div>
      {submissionStatus ? <p className="privacy-notice">{submissionStatus}</p> : null}
      <div className="row">
        <button className="button secondary" type="button" onClick={onBack}>
          Back to review
        </button>
      </div>
    </section>
  );
}
