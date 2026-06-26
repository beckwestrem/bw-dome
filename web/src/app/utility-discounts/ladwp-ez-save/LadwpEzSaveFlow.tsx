"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import {
  LADWP_EZ_SAVE_FIELDS,
  LADWP_EZ_SAVE_WORKFLOW,
} from "@/programs/ladwp_ez_save/workflow";
import { LADWP_EZ_SAVE_THRESHOLDS } from "@/programs/ladwp_ez_save/rules";
import type {
  LadwpEzSaveApplicationDraft,
  LadwpEzSaveBillExtractedField,
  LadwpEzSaveBillExtractionResult,
  LadwpEzSaveDraftField,
  LadwpEzSaveEligibilityResult,
  LadwpEzSaveInput,
} from "@/programs/ladwp_ez_save/types";

type Step = "landing" | "form" | "result" | "review" | "handoff";
type LandingTab = "home" | "eligibility" | "more";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(formData: FormData, key: string) {
  const rawValue = formData.get(key);
  const value =
    typeof rawValue === "string"
      ? Number(rawValue.replace(/[$,]/g, ""))
      : Number(rawValue);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function booleanValue(formData: FormData, key: string) {
  const value = formData.get(key);
  if (value === "yes" || value === "true" || value === "on") return true;
  if (value === "no" || value === "false") return false;
  return undefined;
}

const SERVICE_STREET_ADDRESS_KEY = "service_address_street";

const serviceStreetAddressDefinition = {
  fieldKey: SERVICE_STREET_ADDRESS_KEY,
  label: "Service street address",
  type: "text",
  required: true,
  userHelpText:
    "Use the street address for the home receiving LADWP service, including the number, direction, street name, and suffix if they appear on the bill.",
  sourcePriority: ["user_answer", "uploaded_bill", "manual_edit"],
  canLlmFill: true,
  requiresUserConfirmation: true,
  validation: "Street number and street name text.",
} satisfies (typeof LADWP_EZ_SAVE_FIELDS)[number];

function splitServiceStreetAddress(value: string | undefined) {
  const address = value?.trim();
  if (!address) {
    return {
      serviceAddressStreetNumber: undefined,
      serviceAddressStreetName: undefined,
    };
  }

  const match = address.match(/^(\S+)\s+(.+)$/);
  if (!match) {
    return {
      serviceAddressStreetNumber: undefined,
      serviceAddressStreetName: address,
    };
  }

  return {
    serviceAddressStreetNumber: match[1],
    serviceAddressStreetName: match[2].trim(),
  };
}

function formatServiceStreetAddress(values: Record<string, string>) {
  return [
    values.service_address_street_number,
    values.service_address_street_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
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
  const splitAddress = splitServiceStreetAddress(
    draftValues[SERVICE_STREET_ADDRESS_KEY],
  );

  for (const definition of LADWP_EZ_SAVE_FIELDS) {
    const rawValue =
      definition.fieldKey === "service_address_street_number"
        ? splitAddress.serviceAddressStreetNumber ?? ""
        : definition.fieldKey === "service_address_street_name"
          ? splitAddress.serviceAddressStreetName ?? ""
          : draftValues[definition.fieldKey] ?? "";
    const value = parseDraftValue(rawValue, definition);
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
  let serviceAddressStreetNumber = "";
  let serviceAddressStreetName = "";

  for (const field of fields) {
    if (field.fieldKey === "serviceAddressStreetNumber") {
      serviceAddressStreetNumber = formatExtractedFieldValue(field);
      applied += 1;
      continue;
    }

    if (field.fieldKey === "serviceAddressStreetName") {
      serviceAddressStreetName = formatExtractedFieldValue(field);
      applied += 1;
      continue;
    }

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

  const serviceStreetAddress = [
    serviceAddressStreetNumber,
    serviceAddressStreetName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (serviceStreetAddress) {
    setFormControlValue(form, "serviceStreetAddress", serviceStreetAddress);
  }

  return applied;
}

function draftValuesFromFields(fields: LadwpEzSaveDraftField[]) {
  const values = Object.fromEntries(
    fields.map((field) => [field.fieldKey, formatValue(field.value)]),
  );
  return {
    ...values,
    [SERVICE_STREET_ADDRESS_KEY]: formatServiceStreetAddress(values),
  };
}

function reviewFieldDefinitions() {
  const fields: (typeof LADWP_EZ_SAVE_FIELDS)[number][] = [];
  for (const field of LADWP_EZ_SAVE_FIELDS) {
    if (field.fieldKey === "service_address_street_number") {
      fields.push(serviceStreetAddressDefinition);
      continue;
    }
    if (field.fieldKey === "service_address_street_name") continue;
    fields.push(field);
  }
  return fields;
}

function missingFieldLabel(fieldKey: string) {
  if (
    fieldKey === "service_address_street_number" ||
    fieldKey === "service_address_street_name"
  ) {
    return serviceStreetAddressDefinition.label;
  }
  return fieldDefinition(fieldKey)?.label ?? fieldKey;
}

function selectOptionLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function LadwpEzSaveFlow() {
  const [step, setStep] = useState<Step>("landing");
  const [landingTab, setLandingTab] = useState<LandingTab>("home");
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
    const serviceStreetAddress = splitServiceStreetAddress(
      textValue(formData, "serviceStreetAddress"),
    );

    return {
      utilityProvider: String(formData.get("utilityProvider") ?? "LADWP"),
      isLadwpCustomer: booleanValue(formData, "isLadwpCustomer"),
      zipCode: textValue(formData, "zipCode"),
      firstName: textValue(formData, "firstName"),
      lastName: textValue(formData, "lastName"),
      middleInitial: textValue(formData, "middleInitial"),
      serviceAddressStreetNumber: serviceStreetAddress.serviceAddressStreetNumber,
      serviceAddressStreetName: serviceStreetAddress.serviceAddressStreetName,
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
      setDraftValues(draftValuesFromFields(preparedDraft.fields));
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
    return reviewFieldDefinitions().map((field) => {
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
        <>
          <LandingTabs activeTab={landingTab} onChange={setLandingTab} />
          {landingTab === "home" ? <LandingHome onStart={start} /> : null}
          {landingTab === "eligibility" ? <EligibilityCheckInfo onStart={start} /> : null}
          {landingTab === "more" ? <MoreInfoPage /> : null}
        </>
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
            onPdf={tryPdf}
          />
        ) : null}
      </div>
    </main>
  );
}

function LandingTabs({
  activeTab,
  onChange,
}: {
  activeTab: LandingTab;
  onChange: (tab: LandingTab) => void;
}) {
  const tabs: { key: LandingTab; label: string }[] = [
    { key: "home", label: "Home" },
    { key: "eligibility", label: "Eligibility check" },
    { key: "more", label: "More info" },
  ];

  return (
    <nav className="utility-tabbar" aria-label="EZ-SAVE page sections">
      {tabs.map((tab) => (
        <button
          aria-current={activeTab === tab.key ? "page" : undefined}
          className="utility-tabbar__button"
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

function LandingHome({ onStart }: { onStart: () => void }) {
  return (
    <>
      <section className="utility-landing utility-landing--ladwp" aria-labelledby="ladwp-title">
        <div className="utility-landing__copy">
          <p className="kicker">LADWP EZ-SAVE Program</p>
          <h1 id="ladwp-title">
            Automated EZ-SAVE Applications: in less than 5 minutes, LA residents
            can cut their utility bills with a single, free application.
          </h1>
          <p className="muted lead">
            Answer a few short questions to automate your application quickly.
            EZ-SAVE is LADWP&apos;s income-qualified utility discount program for
            eligible residential customers.
          </p>
          <div className="utility-landing__actions">
            <button className="button button--emphasis" type="button" onClick={onStart}>
              Begin here
            </button>
          </div>
          <p className="muted utility-fineprint">
            Approval is decided by LADWP. Once accepted and enrolled, EZ-SAVE
            participants receive the program&apos;s bill discount and utility
            shutoff protections related to late payment.
          </p>
        </div>
        <div className="utility-landing__panel" aria-label="EZ-SAVE summary">
          <span>income-qualified residential discount</span>
          <strong>EZ-SAVE</strong>
          <p>
            Completed PDF prep today. Automated fax to program administrators is
            coming soon.
          </p>
        </div>
      </section>
      <EzSaveFaq />
    </>
  );
}

function EligibilityCheckInfo({ onStart }: { onStart: () => void }) {
  const incomeRows = Object.entries(LADWP_EZ_SAVE_THRESHOLDS.householdMaxIncome);

  return (
    <section className="utility-info-page" aria-labelledby="eligibility-title">
      <div className="utility-info-page__header">
        <p className="kicker">eligibility check</p>
        <h1 id="eligibility-title">What LADWP usually checks</h1>
        <p className="muted lead">
          Even if you are unsure about your eligibility, you can always still
          apply. LADWP makes the final decision.
        </p>
      </div>

      <div className="eligibility-chart" aria-label="EZ-SAVE eligibility requirements">
        <div className="eligibility-chart__row">
          <strong>LADWP residential customer</strong>
          <span>The account should be for your home&apos;s LADWP electric or water service.</span>
        </div>
        <div className="eligibility-chart__row">
          <strong>Customer of record</strong>
          <span>The application should match the person named on the LADWP account.</span>
        </div>
        <div className="eligibility-chart__row">
          <strong>Primary residence</strong>
          <span>The address should be where you live most of the time.</span>
        </div>
        <div className="eligibility-chart__row">
          <strong>Not claimed as a dependent</strong>
          <span>Applicants generally cannot be listed as someone else&apos;s tax dependent.</span>
        </div>
        <div className="eligibility-chart__row">
          <strong>Household income</strong>
          <span>Household income is compared with LADWP&apos;s current income limits.</span>
        </div>
      </div>

      <section className="utility-income-table" aria-labelledby="income-limits-title">
        <h2 id="income-limits-title">Current income guide</h2>
        <div className="utility-income-table__grid">
          {incomeRows.map(([size, limit]) => (
            <div className="utility-income-table__cell" key={size}>
              <span>{size} person{size === "1" ? "" : "s"}</span>
              <strong>${limit.toLocaleString()}</strong>
            </div>
          ))}
        </div>
        <p className="muted utility-fineprint">
          For households over 8 people, add $
          {LADWP_EZ_SAVE_THRESHOLDS.additionalPersonAmount.toLocaleString()} for
          each additional person.
        </p>
      </section>

      <button className="button button--emphasis utility-result__apply" type="button" onClick={onStart}>
        Start application
      </button>
    </section>
  );
}

function MoreInfoPage() {
  return (
    <section className="utility-info-page" aria-labelledby="more-info-title">
      <div className="utility-info-page__header">
        <p className="kicker">more info</p>
        <h1 id="more-info-title">Learn more before you apply</h1>
        <p className="muted lead">
          EZ-SAVE can lower monthly LADWP costs for eligible households. This
          tool prepares a draft, but LADWP reviews and approves the application.
        </p>
      </div>

      <div className="utility-landing__actions utility-info-page__actions">
        <a
          className="button button--emphasis"
          href={LADWP_EZ_SAVE_WORKFLOW.applicationUrl}
          rel="noreferrer"
          target="_blank"
        >
          Learn about EZ-SAVE
        </a>
        <a className="button secondary" href="sms:+13233933120">
          Text assistance or feedback
        </a>
      </div>

      <p className="privacy-notice">
        Text <strong>+1 (323) 393-3120</strong> to get assistance or provide
        feedback.
      </p>

      <section className="utility-info-grid" aria-label="Why EZ-SAVE matters">
        <article>
          <h2>Lower monthly LADWP costs</h2>
          <p>
            EZ-SAVE is designed to reduce utility bills for eligible LADWP
            residential customers. A lower bill can make it easier to stay
            current each month.
          </p>
        </article>
        <article>
          <h2>Protection after enrollment</h2>
          <p>
            After LADWP accepts the application and enrolls the account,
            participants receive program protections related to utility shutoff
            for late payment.
          </p>
        </article>
        <article>
          <h2>No income proof uploaded here</h2>
          <p>
            The EZ-SAVE application does not require proof of income with the
            initial packet. LADWP may verify eligibility later.
          </p>
        </article>
      </section>
    </section>
  );
}

function EzSaveFaq() {
  return (
    <section className="utility-faq" aria-labelledby="ladwp-faq-title">
      <div>
        <p className="kicker">FAQ</p>
        <h2 id="ladwp-faq-title">Common EZ-SAVE questions</h2>
      </div>
      <details>
        <summary>Who is EZ-SAVE for?</summary>
        <p>
          EZ-SAVE is for income-qualified LADWP residential customers. The
          application is tied to the LADWP customer of record and the
          household&apos;s primary residence.
        </p>
      </details>
      <details>
        <summary>Does this submit my application automatically?</summary>
        <p>
          Yes. Once your information is entered, there are multiple ways to
          submit your application, including an email draft generated for you,
          an automatic fax option, and a filled PDF you can review and send.
        </p>
      </details>
      <details>
        <summary>How long can approval take?</summary>
        <p>
          LADWP controls review timing, so acceptance is not instant. Plan for
          processing time after submission, and contact LADWP directly if your
          bill is urgent or already past due.
        </p>
      </details>
      <details>
        <summary>What if my bill is already past due?</summary>
        <p>
          You can still check EZ-SAVE. Because shutoff protections apply after
          LADWP accepts and enrolls the account, it may also be worth contacting
          LADWP about payment assistance or arrangements.
        </p>
      </details>
      <details>
        <summary>Do I need to upload a utility bill?</summary>
        <p>
          No. Upload is optional and only helps prefill simple account details
          when possible. You can complete the whole workflow manually.
        </p>
      </details>
    </section>
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
            hint="Choose yes if this is an LADWP residential electric or water account for the home where you live."
            label="Are you an LADWP residential customer?"
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
            <span className="muted utility-field-help">
              Use the first name of the LADWP customer of record.
            </span>
          </label>
          <label>
            Last name
            <input autoComplete="family-name" name="lastName" placeholder="Garcia" />
            <span className="muted utility-field-help">
              Use the last name exactly as it should appear on the application.
            </span>
          </label>
          <label>
            Middle initial
            <input maxLength={1} name="middleInitial" placeholder="A" />
            <span className="muted utility-field-help">
              Optional. Leave blank if you do not use a middle initial.
            </span>
          </label>
          <label>
            Service street address
            <input
              autoComplete="street-address"
              name="serviceStreetAddress"
              placeholder="123 Spring St"
            />
            <span className="muted utility-field-help">
              Use the street address for the home receiving LADWP service.
            </span>
          </label>
          <label>
            Apartment number
            <input name="apartmentNumber" placeholder="4B" />
            <span className="muted utility-field-help">
              Optional. Use the apartment, unit, space, or suite number.
            </span>
          </label>
          <label>
            Home telephone
            <input inputMode="tel" name="phone" placeholder="213-555-0100" />
            <span className="muted utility-field-help">
              Recommended so LADWP can reach you if the application needs review.
            </span>
          </label>
          <label>
            Mobile telephone
            <input inputMode="tel" name="mobilePhone" placeholder="323-555-0100" />
            <span className="muted utility-field-help">
              Optional. Add the best mobile number for application follow-up.
            </span>
          </label>
          <label>
            Household total
            <input min={1} name="householdTotal" type="number" />
            <span className="muted utility-field-help">
              Count everyone who lives in the household, including children,
              relatives, and roommates.
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
            <input
              inputMode="decimal"
              name="annualGrossHouseholdIncome"
              placeholder="64000"
            />
            <span className="muted utility-field-help">
              Enter yearly income before taxes for everyone in the household.
              LADWP may verify eligibility later.
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
            defaultValue="no"
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
            <span className="muted utility-field-help">
              Optional. LADWP&apos;s official packet lists online, fax, and mail
              submission, not email submission.
            </span>
          </label>
          <label>
            Monthly bill amount
            <input inputMode="decimal" name="monthlyBillAmount" placeholder="180" />
            <span className="muted utility-field-help">
              Optional. This helps estimate how meaningful a monthly discount
              could be for you.
            </span>
          </label>
          <SelectBoolean
            hint="Optional. If yes, you may also want to contact LADWP about payment assistance or a payment arrangement."
            label="Is the bill past due?"
            name="pastDueStatus"
            optional
          />
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
            <input name="consentToContact" type="checkbox" />
            <span>Email me my application draft or remind me to check my next LADWP bill.</span>
          </label>
        </fieldset>

        <div className="row">
          <button className="button" disabled={loading} type="submit">
            {loading ? "Checking…" : "Start application"}
          </button>
          {status ? <p className="muted">{status}</p> : null}
        </div>
      </form>
    </section>
  );
}

function SelectBoolean({
  defaultValue,
  hint,
  label,
  name,
  optional = false,
}: {
  defaultValue?: "yes" | "no" | "";
  hint?: string;
  label: string;
  name: string;
  optional?: boolean;
}) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={defaultValue ?? (optional ? "" : "yes")}>
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
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const fieldsByKey = new Map(draft.fields.map((field) => [field.fieldKey, field]));
  const missing = draft.missingFields
    .map(missingFieldLabel)
    .filter((label, index, labels) => labels.indexOf(label) === index)
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
        {reviewFieldDefinitions().map((definition) => {
          const field =
            definition.fieldKey === SERVICE_STREET_ADDRESS_KEY
              ? fieldsByKey.get("service_address_street_name") ??
                fieldsByKey.get("service_address_street_number")
              : fieldsByKey.get(definition.fieldKey);
          const value = draftValues[definition.fieldKey] ?? "";
          const updateValue = (nextValue: string) =>
            setDraftValues((current) => ({
              ...current,
              [definition.fieldKey]: nextValue,
            }));
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
                {definition.type === "select" ? (
                  <select
                    value={value}
                    onChange={(event) => updateValue(event.currentTarget.value)}
                  >
                    {(definition.allowedValues ?? []).map((option) => (
                      <option key={option} value={option}>
                        {selectOptionLabel(option)}
                      </option>
                    ))}
                  </select>
                ) : definition.type === "boolean" ? (
                  <select
                    value={value.toLowerCase()}
                    onChange={(event) => updateValue(event.currentTarget.value)}
                  >
                    <option value="">Not sure</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                ) : (
                  <input
                    value={value}
                    onChange={(event) => updateValue(event.currentTarget.value)}
                  />
                )}
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
      <label className="toggle-field">
        <input
          checked={reviewConfirmed}
          type="checkbox"
          onChange={(event) => setReviewConfirmed(event.currentTarget.checked)}
        />
        <span>I reviewed these answers and want to continue to LADWP.</span>
      </label>
      <div className="row">
        <button className="button" type="button" onClick={onCopy}>
          Copy all answers
        </button>
        <button
          className="button secondary"
          disabled={!reviewConfirmed}
          type="button"
          onClick={onContinue}
        >
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
  onPdf,
}: {
  pdfStatus: string;
  submissionStatus: string;
  onBack: () => void;
  onEmailDraft: () => void;
  onPdf: () => void;
}) {
  return (
    <section className="utility-result">
      <div className="utility-result__header">
        <p className="kicker">submission handoff</p>
        <h1>Your draft is ready</h1>
        <p className="muted lead">
          Review the generated packet, then choose how you want to send the
          information you entered here.
        </p>
      </div>
      <div className="utility-result__grid">
        <section className="utility-result__section">
          <h2>Email submission</h2>
          <p className="muted">
            Download the packet and open a prewritten email draft. Attach the
            signed PDF before sending.
          </p>
          <button className="button" type="button" onClick={onEmailDraft}>
            Prepare email submission
          </button>
          <p className="muted utility-fineprint">
            {LADWP_EZ_SAVE_WORKFLOW.emailSubmissionNote}
          </p>
        </section>
        <section className="utility-result__section">
          <h2>Download PDF</h2>
          <p className="muted">
            Save the filled packet so you can sign it and send it yourself by
            fax or email.
          </p>
          <div className="row">
            <button className="button secondary" type="button" onClick={onPdf}>
              Download PDF for fax or email
            </button>
            <button className="button secondary" type="button" onClick={onBack}>
              Edit information
            </button>
          </div>
          <p className="muted utility-fineprint">
            If anything on the PDF is incorrect, edit your information before
            signing or submitting.
          </p>
          {pdfStatus ? <p className="muted">{pdfStatus}</p> : null}
        </section>
        <section className="utility-result__section">
          <h2>Automatic fax</h2>
          <p className="muted">
            Send the completed packet directly by fax from this app.
          </p>
          <p className="muted">Fax: {LADWP_EZ_SAVE_WORKFLOW.faxNumber}</p>
          <button className="button secondary" disabled type="button">
            Automatic fax coming soon
          </button>
          <p className="muted utility-fineprint">
            This is disabled until the automatic fax provider is connected.
          </p>
        </section>
      </div>
      {submissionStatus ? <p className="privacy-notice">{submissionStatus}</p> : null}
      <div className="row">
        <button className="button secondary" type="button" onClick={onBack}>
          Edit information
        </button>
      </div>
    </section>
  );
}
