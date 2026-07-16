"use client";

import { FormEvent, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { ArrowRight, Download, Info, Send, Upload } from "lucide-react";

import { EzBrand, EzRadioGroup, EzStatusBanner, EzStepIndicator } from "@/app/components/EzUi";
import { ADMIN_TEST_FAX_NUMBER } from "@/programs/ladwp_ez_save/fax-destination";
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

type Step = "eligibility" | "application" | "review" | "submit";
type SubmissionNotice = {
  tone: "pending" | "success" | "error";
  title: string;
  message: string;
};

const SERVICE_STREET_ADDRESS_KEY = "service_address_street";
const yesNo = [
  { label: "Yes", value: "yes" as const },
  { label: "No", value: "no" as const },
];
const yesNoUnsure = [
  ...yesNo,
  { label: "Not sure", value: "" as const },
];

const serviceStreetAddressDefinition = {
  fieldKey: SERVICE_STREET_ADDRESS_KEY,
  label: "Service street address",
  type: "text",
  required: true,
  userHelpText: "Use the street address for the home receiving LADWP service.",
  sourcePriority: ["user_answer", "uploaded_bill", "manual_edit"],
  canLlmFill: true,
  requiresUserConfirmation: true,
  validation: "Street number and street name text.",
} satisfies (typeof LADWP_EZ_SAVE_FIELDS)[number];

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(formData: FormData, key: string) {
  const rawValue = formData.get(key);
  if (typeof rawValue === "string" && !rawValue.trim()) return undefined;
  const value = typeof rawValue === "string"
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

function booleanFormValue(value: boolean | undefined) {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "";
}

function splitServiceStreetAddress(value: string | undefined) {
  const address = value?.trim();
  if (!address) return { serviceAddressStreetNumber: undefined, serviceAddressStreetName: undefined };
  const match = address.match(/^(\S+)\s+(.+)$/);
  if (!match) return { serviceAddressStreetNumber: undefined, serviceAddressStreetName: address };
  return { serviceAddressStreetNumber: match[1], serviceAddressStreetName: match[2].trim() };
}

function formatServiceStreetAddress(values: Record<string, string>) {
  return [values.service_address_street_number, values.service_address_street_name]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function fieldDefinition(fieldKey: string) {
  return LADWP_EZ_SAVE_FIELDS.find((field) => field.fieldKey === fieldKey);
}

function formatValue(value: LadwpEzSaveDraftField["value"] | undefined) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function parseDraftValue(rawValue: string, definition: (typeof LADWP_EZ_SAVE_FIELDS)[number]) {
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
  const splitAddress = splitServiceStreetAddress(draftValues[SERVICE_STREET_ADDRESS_KEY]);

  for (const definition of LADWP_EZ_SAVE_FIELDS) {
    const rawValue = definition.fieldKey === "service_address_street_number"
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
  if (typeof value === "object" && value !== null && "error" in value && typeof value.error === "string") {
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
  if (control instanceof RadioNodeList) {
    control.value = value;
  } else if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement) {
    control.value = value;
  }
}

function formatExtractedFieldValue(field: LadwpEzSaveBillExtractedField) {
  if (typeof field.value === "boolean") return field.value ? "yes" : "no";
  return String(field.value);
}

function applyExtractedFieldsToForm(form: HTMLFormElement, fields: LadwpEzSaveBillExtractedField[]) {
  let applied = 0;
  let streetNumber = "";
  let streetName = "";
  for (const field of fields) {
    if (field.fieldKey === "serviceAddressStreetNumber") {
      streetNumber = formatExtractedFieldValue(field);
      applied += 1;
      continue;
    }
    if (field.fieldKey === "serviceAddressStreetName") {
      streetName = formatExtractedFieldValue(field);
      applied += 1;
      continue;
    }
    const name = extractableInputNames[field.fieldKey];
    if (!name) continue;
    setFormControlValue(form, name, formatExtractedFieldValue(field));
    applied += 1;
  }
  const serviceAddress = [streetNumber, streetName].filter(Boolean).join(" ").trim();
  if (serviceAddress) setFormControlValue(form, "serviceStreetAddress", serviceAddress);
  return applied;
}

function draftValuesFromFields(fields: LadwpEzSaveDraftField[]) {
  const values = Object.fromEntries(fields.map((field) => [field.fieldKey, formatValue(field.value)]));
  return { ...values, [SERVICE_STREET_ADDRESS_KEY]: formatServiceStreetAddress(values) };
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
  if (fieldKey === "service_address_street_number" || fieldKey === "service_address_street_name") {
    return serviceStreetAddressDefinition.label;
  }
  return fieldDefinition(fieldKey)?.label ?? fieldKey;
}

function selectOptionLabel(value: string) {
  return value.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function reviewDisplayValue(
  definition: (typeof LADWP_EZ_SAVE_FIELDS)[number],
  value: string,
) {
  if (!value) return "Not provided";
  if (definition.type === "boolean") {
    if (value.toLowerCase() === "yes") return "Yes";
    if (value.toLowerCase() === "no") return "No";
  }
  if (definition.type === "select") return selectOptionLabel(value);
  if (["annual_gross_household_income", "monthly_bill_amount"].includes(definition.fieldKey)) {
    const amount = Number(value.replace(/[$,]/g, ""));
    if (Number.isFinite(amount)) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(amount);
    }
  }
  return value;
}

function eligibilityPresentation(result: LadwpEzSaveEligibilityResult) {
  if (result.confidence === "LIKELY") return { tone: "success" as const, title: "You very likely qualify" };
  if (result.confidence === "POSSIBLE") return { tone: "warning" as const, title: "You might qualify" };
  return { tone: "neutral" as const, title: "You probably wouldn’t qualify" };
}

export function LadwpEzSaveFlow() {
  const [step, setStep] = useState<Step>("eligibility");
  const [eligibilityAnswers, setEligibilityAnswers] = useState<Partial<LadwpEzSaveInput>>({});
  const [eligibilityResult, setEligibilityResult] = useState<LadwpEzSaveEligibilityResult | null>(null);
  const [eligibilityStatus, setEligibilityStatus] = useState("");
  const [draft, setDraft] = useState<LadwpEzSaveApplicationDraft | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [pdfStatus, setPdfStatus] = useState("");
  const [submissionNotice, setSubmissionNotice] = useState<SubmissionNotice | null>(null);
  const [receiptUrl, setReceiptUrl] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  function changeStep(next: Step) {
    setStep(next);
    window.requestAnimationFrame(() => contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function submitEligibility(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const answers: Partial<LadwpEzSaveInput> = {
      utilityProvider: "LADWP",
      isLadwpCustomer: booleanValue(formData, "isLadwpCustomer"),
      householdTotal: numberValue(formData, "householdTotal"),
      annualGrossHouseholdIncome: numberValue(formData, "annualGrossHouseholdIncome"),
      isCustomerOfRecord: booleanValue(formData, "isCustomerOfRecord"),
      isPrimaryResidence: booleanValue(formData, "isPrimaryResidence"),
      claimedAsDependent: booleanValue(formData, "claimedAsDependent"),
    };
    setEligibilityAnswers(answers);
    setEligibilityStatus("Checking your answers…");
    setEligibilityResult(null);
    try {
      const response = await fetch("/api/programs/ladwp-ez-save/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });
      const json = (await response.json()) as LadwpEzSaveEligibilityResult | { error?: string };
      const error = apiError(json);
      if (!response.ok || error) {
        setEligibilityStatus(error ?? "We couldn’t check eligibility right now. You can still continue.");
        return;
      }
      setEligibilityResult(json as LadwpEzSaveEligibilityResult);
      setEligibilityStatus("");
    } catch {
      setEligibilityStatus("We couldn’t connect right now. You can still continue with an application.");
    }
  }

  function collectPayload(formData: FormData): Partial<LadwpEzSaveInput> {
    const serviceAddress = splitServiceStreetAddress(textValue(formData, "serviceStreetAddress"));
    return {
      ...eligibilityAnswers,
      utilityProvider: String(formData.get("utilityProvider") ?? "LADWP"),
      isLadwpCustomer: booleanValue(formData, "isLadwpCustomer") ?? eligibilityAnswers.isLadwpCustomer,
      zipCode: textValue(formData, "zipCode"),
      firstName: textValue(formData, "firstName"),
      lastName: textValue(formData, "lastName"),
      middleInitial: textValue(formData, "middleInitial"),
      serviceAddressStreetNumber: serviceAddress.serviceAddressStreetNumber,
      serviceAddressStreetName: serviceAddress.serviceAddressStreetName,
      apartmentNumber: textValue(formData, "apartmentNumber"),
      phone: textValue(formData, "phone"),
      mobilePhone: textValue(formData, "mobilePhone"),
      householdTotal: numberValue(formData, "householdTotal") ?? eligibilityAnswers.householdTotal,
      householdAdults: numberValue(formData, "householdAdults"),
      householdChildren: numberValue(formData, "householdChildren"),
      annualGrossHouseholdIncome: numberValue(formData, "annualGrossHouseholdIncome") ?? eligibilityAnswers.annualGrossHouseholdIncome,
      isCustomerOfRecord: booleanValue(formData, "isCustomerOfRecord") ?? eligibilityAnswers.isCustomerOfRecord,
      isPrimaryResidence: booleanValue(formData, "isPrimaryResidence") ?? eligibilityAnswers.isPrimaryResidence,
      claimedAsDependent: booleanValue(formData, "claimedAsDependent") ?? eligibilityAnswers.claimedAsDependent,
      newApplicationOrRenewal: formData.get("newApplicationOrRenewal") === "renewal" ? "renewal" : "new_application",
      consentToPrepareApplication: booleanValue(formData, "consentToPrepareApplication"),
      email: textValue(formData, "email"),
      includeAccountNumberInDraft: true,
      accountNumber: textValue(formData, "accountNumber"),
      monthlyBillAmount: numberValue(formData, "monthlyBillAmount"),
      pastDueStatus: booleanValue(formData, "pastDueStatus"),
      consentToContact: booleanValue(formData, "consentToContact"),
    };
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("Preparing your application…");
    const payload = collectPayload(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/programs/ladwp-ez-save/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await response.json()) as LadwpEzSaveApplicationDraft | { error?: string };
      const error = apiError(json);
      if (!response.ok || error) {
        setStatus(error ?? "We couldn’t prepare your application. Please try again.");
        return;
      }
      const preparedDraft = json as LadwpEzSaveApplicationDraft;
      setDraft(preparedDraft);
      setDraftValues(draftValuesFromFields(preparedDraft.fields));
      setStatus("");
      changeStep("review");
    } catch {
      setStatus("We couldn’t connect. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf() {
    if (!draft) return;
    setPdfStatus("Preparing your PDF…");
    setSubmissionNotice(null);
    const reviewedDraft = draftWithReviewedValues(draft, draftValues);
    const response = await fetch("/api/programs/ladwp-ez-save/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reviewedDraft),
    });
    if (!response.ok) {
      const json = (await response.json()) as { reason?: string };
      setPdfStatus(json.reason ?? "We couldn’t create the PDF right now.");
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
    setPdfStatus("PDF downloaded. Review and sign it before submitting it to LADWP.");
  }

  async function faxApplication(signature: {
    signerName: string;
    signerEmail?: string | null;
    consentAccepted: boolean;
    adminFaxTest?: boolean;
  }) {
    if (!draft) return;
    const reviewedDraft = draftWithReviewedValues(draft, draftValues);
    setPdfStatus("");
    setReceiptUrl("");
    setSubmissionNotice({ tone: "pending", title: "Sending your application", message: "We’re signing the completed PDF and sending it by fax." });
    const response = await fetch("/api/programs/ladwp-ez-save/submit/fax", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft: reviewedDraft, signature, adminFaxTest: Boolean(signature.adminFaxTest) }),
    });
    const json = (await response.json()) as {
      ok?: boolean; message?: string; reason?: string; error?: string; receiptUrl?: string;
      confirmationId?: string; status?: string; faxNumber?: string;
    };
    setReceiptUrl(json.receiptUrl ?? "");
    if (!response.ok || !json.ok) {
      setSubmissionNotice({ tone: "error", title: "Your fax was not sent", message: json.reason ?? json.error ?? "Please try again or download the PDF instead." });
      return;
    }
    setSubmissionNotice({
      tone: "success",
      title: "Application faxed to LADWP",
      message: `${json.message ?? "Your application was sent."}${json.confirmationId ? ` Confirmation: ${json.confirmationId}.` : ""}${json.faxNumber ? ` Destination: ${json.faxNumber}.` : ""}`,
    });
  }

  return (
    <div className="ez-shell ez-app-shell">
      <header className="ez-app-nav"><div className="ez-container"><EzBrand /><span>Secure application</span></div></header>
      <main className="ez-app-main" ref={contentRef}>
        <div className="ez-app-container">
          <EzStepIndicator current={step === "eligibility" ? 1 : step === "application" ? 2 : step === "review" ? 3 : 4} />
          {step === "eligibility" ? (
            <EligibilityStep
              result={eligibilityResult}
              status={eligibilityStatus}
              onSubmit={submitEligibility}
              onContinue={() => changeStep("application")}
            />
          ) : null}
          {step === "application" ? (
            <ApplicationForm
              eligibilityAnswers={eligibilityAnswers}
              loading={loading}
              status={status}
              onBack={() => changeStep("eligibility")}
              onSubmit={submitApplication}
            />
          ) : null}
          {step === "review" && draft ? (
            <ReviewPanel
              draft={draft}
              draftValues={draftValues}
              setDraftValues={setDraftValues}
              onBack={() => changeStep("application")}
              onContinue={() => changeStep("submit")}
            />
          ) : null}
          {step === "submit" && draft ? (
            <SubmissionPanel
              pdfStatus={pdfStatus}
              receiptUrl={receiptUrl}
              submissionNotice={submissionNotice}
              onBack={() => changeStep("review")}
              onFax={faxApplication}
              onPdf={downloadPdf}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}

function EligibilityStep({
  result,
  status,
  onSubmit,
  onContinue,
}: {
  result: LadwpEzSaveEligibilityResult | null;
  status: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onContinue: () => void;
}) {
  const presentation = result ? eligibilityPresentation(result) : null;
  return (
    <section className="ez-flow-card ez-eligibility-step" aria-labelledby="eligibility-step-title">
      <div className="ez-flow-heading">
        <p className="ez-kicker">Takes about 60 seconds</p>
        <h1 id="eligibility-step-title">Check if you might qualify</h1>
        <p>Answer a few questions for a quick estimate. This will not stop you from applying.</p>
      </div>
      <form className="ez-quick-form" onSubmit={onSubmit}>
        <input type="hidden" name="utilityProvider" value="LADWP" />
        <EzRadioGroup legend="Do you have a residential LADWP account for your home?" name="isLadwpCustomer" defaultValue="yes" options={yesNo} />
        <div className="ez-form-grid ez-form-grid--two">
          <label className="ez-field"><span>People in your household</span><input min={1} name="householdTotal" type="number" required /><small>Count everyone who lives with you.</small></label>
          <label className="ez-field"><span>Total annual household income</span><div className="ez-input-prefix"><span>$</span><input inputMode="decimal" name="annualGrossHouseholdIncome" required /></div><small>Use gross income before taxes.</small></label>
        </div>
        <EzRadioGroup legend="Are you the person named on the LADWP account?" name="isCustomerOfRecord" defaultValue="yes" options={yesNoUnsure} />
        <EzRadioGroup legend="Is this account for your primary home?" name="isPrimaryResidence" defaultValue="yes" options={yesNoUnsure} />
        <EzRadioGroup legend="Can someone else claim you as a dependent on their taxes?" name="claimedAsDependent" defaultValue="no" options={yesNoUnsure} />
        <button className="ez-button ez-button--wide" type="submit">Check my eligibility</button>
      </form>
      {status ? <EzStatusBanner tone="warning" title="Eligibility check">{status}</EzStatusBanner> : null}
      {status ? <button className="ez-button" type="button" onClick={onContinue}>Continue to application</button> : null}
      {result && presentation ? (
        <div className="ez-result-block">
          <EzStatusBanner tone={presentation.tone} title={presentation.title}>
            <p>{result.reasons[0]}</p>
            <p>LADWP makes the final decision. There is no harm in applying if you are unsure.</p>
          </EzStatusBanner>
          <div className="ez-actions">
            <button className="ez-button" type="button" onClick={onContinue}>Continue to application <ArrowRight aria-hidden="true" size={17} /></button>
            <button className="ez-button ez-button--secondary" type="button" onClick={() => document.querySelector<HTMLFormElement>(".ez-quick-form")?.scrollIntoView({ behavior: "smooth" })}>Change answers</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ApplicationForm({
  eligibilityAnswers,
  loading,
  status,
  onBack,
  onSubmit,
}: {
  eligibilityAnswers: Partial<LadwpEzSaveInput>;
  loading: boolean;
  status: string;
  onBack: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [extractStatus, setExtractStatus] = useState("");
  const [extractWarnings, setExtractWarnings] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [fileName, setFileName] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function handleBillUpload(file: File | undefined) {
    if (!file || !formRef.current) return;
    setFileName(file.name);
    setExtracting(true);
    setExtractWarnings([]);
    setExtractStatus("Reading your bill…");
    const body = new FormData();
    body.append("bill", file);
    try {
      const response = await fetch("/api/programs/ladwp-ez-save/bill-extract", { method: "POST", body });
      const json = (await response.json()) as LadwpEzSaveBillExtractionResult | { error?: string };
      const error = apiError(json);
      if (!response.ok || error) {
        setExtractStatus(error ?? "We couldn’t read that bill. You can enter the information manually.");
        return;
      }
      const result = json as LadwpEzSaveBillExtractionResult;
      const applied = applyExtractedFieldsToForm(formRef.current, result.fields);
      setExtractWarnings(result.warnings);
      setExtractStatus(applied > 0 ? `We filled ${applied} field${applied === 1 ? "" : "s"}. Please review them below.` : "We couldn’t find details to prefill. You can continue manually.");
    } catch {
      setExtractStatus("We couldn’t read that bill. You can continue manually.");
    } finally {
      setExtracting(false);
    }
  }

  return (
    <section aria-labelledby="application-title">
      <div className="ez-flow-heading">
        <p className="ez-kicker">Application details</p>
        <h1 id="application-title">Prepare your application</h1>
        <p>Enter the information as it appears on your LADWP account. You will review everything next.</p>
      </div>
      <form className="ez-application-form" ref={formRef} onSubmit={onSubmit}>
        <input type="hidden" name="utilityProvider" value="LADWP" />
        <input type="hidden" name="includeAccountNumberInDraft" value="yes" />
        <input type="hidden" name="isLadwpCustomer" value={booleanFormValue(eligibilityAnswers.isLadwpCustomer)} />
        <input type="hidden" name="isCustomerOfRecord" value={booleanFormValue(eligibilityAnswers.isCustomerOfRecord)} />
        <input type="hidden" name="isPrimaryResidence" value={booleanFormValue(eligibilityAnswers.isPrimaryResidence)} />
        <input type="hidden" name="claimedAsDependent" value={booleanFormValue(eligibilityAnswers.claimedAsDependent)} />

        <FormSection number="1" title="Applicant information" description="Use the name and contact information for the LADWP customer of record.">
          <div className="ez-form-grid ez-form-grid--name">
            <label className="ez-field"><span>First name</span><input autoComplete="given-name" name="firstName" required /></label>
            <label className="ez-field ez-field--short"><span>Middle initial <em>Optional</em></span><input autoComplete="additional-name" maxLength={1} name="middleInitial" /></label>
            <label className="ez-field"><span>Last name</span><input autoComplete="family-name" name="lastName" required /></label>
          </div>
          <div className="ez-form-grid ez-form-grid--two">
            <label className="ez-field"><span>Home telephone <em>Optional</em></span><input autoComplete="tel-national" inputMode="tel" name="phone" /></label>
            <label className="ez-field"><span>Mobile telephone</span><input autoComplete="tel" inputMode="tel" name="mobilePhone" required /><small>Best number for application follow-up.</small></label>
          </div>
          <label className="ez-field"><span>Email <em>Optional</em></span><input autoComplete="email" name="email" type="email" /><small>Used only for reminders or a copy of your receipt.</small></label>
        </FormSection>

        <FormSection number="2" title="LADWP service address" description="Use the address where LADWP provides service.">
          <label className="ez-field"><span>Service street address</span><input autoComplete="street-address" name="serviceStreetAddress" required /></label>
          <div className="ez-form-grid ez-form-grid--two">
            <label className="ez-field"><span>Apartment or unit <em>Optional</em></span><input autoComplete="address-line2" name="apartmentNumber" /></label>
            <label className="ez-field"><span>ZIP code</span><input autoComplete="postal-code" inputMode="numeric" maxLength={5} name="zipCode" required /></label>
          </div>
          <label className="ez-field"><span>LADWP account number <em>Optional</em></span><input autoComplete="off" inputMode="numeric" name="accountNumber" /><small>Recommended if you have it nearby.</small></label>
          <details className="ez-inline-details"><summary>Where can I find my account number?</summary><p>Look near the top of a paper or PDF bill, in your LADWP online account, or on a recent LADWP notice.</p></details>
        </FormSection>

        <FormSection number="3" title="Household details" description="We carried over the answers from your eligibility check.">
          <div className="ez-form-grid ez-form-grid--three">
            <label className="ez-field"><span>Household total</span><input defaultValue={eligibilityAnswers.householdTotal} min={1} name="householdTotal" type="number" required /></label>
            <label className="ez-field"><span>Adults</span><input min={0} name="householdAdults" type="number" required /></label>
            <label className="ez-field"><span>Children</span><input min={0} name="householdChildren" type="number" required /></label>
          </div>
          <label className="ez-field"><span>Total annual gross household income</span><div className="ez-input-prefix"><span>$</span><input defaultValue={eligibilityAnswers.annualGrossHouseholdIncome} inputMode="decimal" name="annualGrossHouseholdIncome" required /></div><small>Income before taxes for everyone in the household.</small></label>
          <div className="ez-form-grid ez-form-grid--two">
            <label className="ez-field"><span>Application type</span><select name="newApplicationOrRenewal" defaultValue="new_application"><option value="new_application">New application</option><option value="renewal">Renewal</option></select></label>
            <label className="ez-field"><span>Monthly bill amount <em>Optional</em></span><div className="ez-input-prefix"><span>$</span><input inputMode="decimal" name="monthlyBillAmount" /></div></label>
          </div>
          <EzRadioGroup legend="Is the bill past due?" name="pastDueStatus" defaultValue="" options={yesNoUnsure} help="Optional. If yes, consider contacting LADWP about a payment arrangement too." />
        </FormSection>

        <section className="ez-upload-card" aria-labelledby="bill-upload-title">
          <div className="ez-upload-card__icon" aria-hidden="true"><Upload size={21} /></div>
          <div><p className="ez-kicker">Bill upload</p><h2 id="bill-upload-title">Upload a recent LADWP bill</h2><p>Optional. Upload a bill to prefill basic account details.</p></div>
          <label className="ez-upload-control"><input accept=".pdf,image/*,.txt,.csv,text/plain,text/csv" name="billUpload" type="file" onChange={(event) => handleBillUpload(event.currentTarget.files?.[0])} /><span>{fileName || "Choose a PDF, image, or text file"}</span><strong>Browse</strong></label>
          {extractStatus ? <EzStatusBanner tone={extracting ? "pending" : "neutral"} title={extracting ? "Reading bill" : "Bill upload"}>{extracting ? "Looking for account details…" : extractStatus}</EzStatusBanner> : null}
          {extractWarnings.length ? <details className="ez-inline-details"><summary>Review upload notes</summary><ul>{extractWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details> : null}
        </section>

        <aside className="ez-privacy-callout"><span aria-hidden="true"><Info size={15} /></span><p><strong>Protect your private information.</strong> Do not upload income documents, identification, Social Security numbers, bank information, or medical records.</p></aside>

        <FormSection number="4" title="Consent" description="Nothing is sent until you review and authorize submission.">
          <label className="ez-check"><input name="consentToPrepareApplication" required type="checkbox" /><span>I want Buffalo Billsaver to prepare my EZ-SAVE application.</span></label>
          <label className="ez-check"><input name="consentToContact" type="checkbox" /><span>Send me a reminder to check my next LADWP bill. <em>Optional</em></span></label>
        </FormSection>

        {status ? <EzStatusBanner tone="error" title="Application">{status}</EzStatusBanner> : null}
        <div className="ez-form-actions"><button className="ez-button ez-button--secondary" type="button" onClick={onBack}>Back</button><button className="ez-button" disabled={loading} type="submit">{loading ? "Preparing…" : "Prepare my application"}</button></div>
      </form>
    </section>
  );
}

function FormSection({ number, title, description, children }: { number: string; title: string; description: string; children: ReactNode }) {
  return <section className="ez-form-section"><header><span>{number}</span><div><h2>{title}</h2><p>{description}</p></div></header><div className="ez-form-section__body">{children}</div></section>;
}

const reviewGroups = [
  { title: "Applicant", keys: ["first_name", "middle_initial", "last_name", "phone", "mobile_phone", "email"] },
  { title: "Service address", keys: [SERVICE_STREET_ADDRESS_KEY, "apartment_number", "zip_code", "account_number"] },
  { title: "Household and eligibility", keys: ["household_total", "household_adults", "household_children", "annual_gross_household_income", "is_ladwp_customer", "is_customer_of_record", "is_primary_residence", "claimed_as_dependent", "new_application_or_renewal"] },
  { title: "Bill and contact details", keys: ["utility_provider", "monthly_bill_amount", "past_due_status", "consent_to_prepare_application"] },
];

function ReviewPanel({ draft, draftValues, setDraftValues, onBack, onContinue }: {
  draft: LadwpEzSaveApplicationDraft;
  draftValues: Record<string, string>;
  setDraftValues: Dispatch<SetStateAction<Record<string, string>>>;
  onBack: () => void;
  onContinue: () => void;
}) {
  const definitions = reviewFieldDefinitions();
  const [confirmed, setConfirmed] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [editingGroups, setEditingGroups] = useState<Record<string, boolean>>(() => (
    Object.fromEntries(reviewGroups.map((group) => [
      group.title,
      group.keys.some((key) => {
        const definition = definitions.find((item) => item.fieldKey === key);
        return Boolean(definition?.required && !draftValues[key]);
      }),
    ]))
  ));
  const missingLabels = draft.missingFields.map(missingFieldLabel).filter((label, index, labels) => labels.indexOf(label) === index);
  const copiedAnswers = definitions.map((field) => `${field.label}: ${draftValues[field.fieldKey] || "[missing]"}`).join("\n");

  async function copyAnswers() {
    await navigator.clipboard.writeText(copiedAnswers);
    setCopyStatus("Answers copied.");
  }

  return (
    <section aria-labelledby="review-title">
      <div className="ez-flow-heading"><p className="ez-kicker">Review</p><h1 id="review-title">Review your information</h1><p>Make sure every answer is accurate. You can edit any field below.</p></div>
      {missingLabels.length ? <EzStatusBanner tone="warning" title="A few details need attention"><p>{missingLabels.join(", ")}</p></EzStatusBanner> : null}
      <div className="ez-review-groups">
        {reviewGroups.map((group) => {
          const slug = group.title.toLowerCase().replaceAll(" ", "-");
          const isEditing = Boolean(editingGroups[group.title]);
          const contentId = `review-${slug}-content`;
          return (
            <section className={`ez-review-group${isEditing ? " is-editing" : ""}`} id={`review-${slug}`} key={group.title}>
              <header>
                <h2>{group.title}</h2>
                <button
                  aria-controls={contentId}
                  aria-expanded={isEditing}
                  type="button"
                  onClick={() => {
                    setEditingGroups((current) => ({ ...current, [group.title]: !isEditing }));
                    if (!isEditing) {
                      requestAnimationFrame(() => document.querySelector<HTMLElement>(`#review-${slug} input, #review-${slug} select`)?.focus());
                    }
                  }}
                >
                  {isEditing ? "Done" : "Edit"}
                </button>
              </header>
              {isEditing ? (
                <div className="ez-review-grid" id={contentId}>
                  {group.keys.map((key) => {
                    const definition = definitions.find((item) => item.fieldKey === key);
                    if (!definition) return null;
                    const value = draftValues[key] ?? "";
                    const needsReview = definition.required && !value;
                    const updateValue = (nextValue: string) => setDraftValues((current) => ({ ...current, [key]: nextValue }));
                    return (
                      <label className={`ez-review-field${needsReview ? " needs-review" : ""}`} key={key}>
                        <span>{definition.label}{definition.required ? " *" : ""}{needsReview ? <em>Needs review</em> : null}</span>
                        {definition.type === "select" ? (
                          <select value={value} onChange={(event) => updateValue(event.currentTarget.value)}>{(definition.allowedValues ?? []).map((option) => <option key={option} value={option}>{selectOptionLabel(option)}</option>)}</select>
                        ) : definition.type === "boolean" ? (
                          <select value={value.toLowerCase()} onChange={(event) => updateValue(event.currentTarget.value)}><option value="">Not sure</option><option value="yes">Yes</option><option value="no">No</option></select>
                        ) : (
                          <input value={value} onChange={(event) => updateValue(event.currentTarget.value)} />
                        )}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <dl className="ez-review-summary" id={contentId}>
                  {group.keys.map((key) => {
                    const definition = definitions.find((item) => item.fieldKey === key);
                    if (!definition) return null;
                    const value = draftValues[key] ?? "";
                    const needsReview = definition.required && !value;
                    return (
                      <div key={key}>
                        <dt>{definition.label}</dt>
                        <dd className={!value ? "is-empty" : undefined}>
                          {reviewDisplayValue(definition, value)}
                          {needsReview ? <em>Needs review</em> : null}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              )}
            </section>
          );
        })}
      </div>
      <details className="ez-more-options"><summary>More options</summary><div><button className="ez-button ez-button--tertiary" type="button" onClick={copyAnswers}>Copy all answers</button>{copyStatus ? <span aria-live="polite">{copyStatus}</span> : null}</div></details>
      <label className="ez-check ez-review-confirm"><input checked={confirmed} type="checkbox" onChange={(event) => setConfirmed(event.currentTarget.checked)} /><span>I reviewed the information above and confirm it is accurate.</span></label>
      <div className="ez-form-actions"><button className="ez-button ez-button--secondary" type="button" onClick={onBack}>Back</button><button className="ez-button" disabled={!confirmed} type="button" onClick={onContinue}>Continue to submission</button></div>
    </section>
  );
}

function SubmissionPanel({ pdfStatus, receiptUrl, submissionNotice, onBack, onFax, onPdf }: {
  pdfStatus: string;
  receiptUrl: string;
  submissionNotice: SubmissionNotice | null;
  onBack: () => void;
  onFax: (signature: { signerName: string; signerEmail?: string | null; consentAccepted: boolean; adminFaxTest?: boolean }) => void;
  onPdf: () => void;
}) {
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [adminFaxTest, setAdminFaxTest] = useState(false);
  const canFax = Boolean(signerName.trim() && consentAccepted);
  const destination = adminFaxTest ? ADMIN_TEST_FAX_NUMBER : LADWP_EZ_SAVE_WORKFLOW.faxNumber;

  return (
    <section aria-labelledby="submit-title">
      <div className="ez-flow-heading"><p className="ez-kicker">Submit</p><h1 id="submit-title">Send your application</h1><p>Fax directly to LADWP, or download the completed PDF and submit it yourself.</p></div>
      {submissionNotice ? <EzStatusBanner tone={submissionNotice.tone} title={submissionNotice.title}>{submissionNotice.message}</EzStatusBanner> : null}
      {receiptUrl ? <a className="ez-button ez-receipt-button" href={receiptUrl}>View receipt <ArrowRight aria-hidden="true" size={17} /></a> : null}
      <div className="ez-submit-layout">
        <section className="ez-submit-card ez-submit-card--primary">
          <div className="ez-submit-card__heading"><span aria-hidden="true"><Send size={19} /></span><div><p className="ez-kicker">Recommended</p><h2>Fax to LADWP</h2><p>Your application will be signed and sent directly to LADWP.</p></div></div>
          <div className="ez-destination"><span>Destination fax number</span><strong>{destination}</strong></div>
          <label className="ez-field"><span>Electronic signature</span><input autoComplete="name" placeholder="Type your full legal name" value={signerName} onChange={(event) => setSignerName(event.currentTarget.value)} /></label>
          <label className="ez-field"><span>Receipt email <em>Optional</em></span><input autoComplete="email" type="email" value={signerEmail} onChange={(event) => setSignerEmail(event.currentTarget.value)} /></label>
          <label className="ez-check"><input checked={consentAccepted} type="checkbox" onChange={(event) => setConsentAccepted(event.currentTarget.checked)} /><span>I reviewed this application and authorize Buffalo Billsaver to apply my electronic signature and fax it to LADWP.</span></label>
          <button className="ez-button ez-button--wide" disabled={!canFax} type="button" onClick={() => onFax({ signerName: signerName.trim(), signerEmail: signerEmail.trim() || null, consentAccepted, adminFaxTest })}>{adminFaxTest ? "Sign and send test fax" : "Sign and fax to LADWP"}</button>
        </section>
        <section className="ez-submit-card">
          <div className="ez-submit-card__heading"><span aria-hidden="true"><Download size={19} /></span><div><h2>Download the completed PDF</h2><p>Save it, fax it yourself, or print and mail it.</p></div></div>
          <button className="ez-button ez-button--secondary ez-button--wide" type="button" onClick={onPdf}>Download PDF</button>
          {pdfStatus ? <p className="ez-inline-status" aria-live="polite">{pdfStatus}</p> : null}
          <details className="ez-mail-details"><summary>Mail instead</summary><p>Print and sign the downloaded application, then mail it to:</p><address>{LADWP_EZ_SAVE_WORKFLOW.mailAddress.map((line) => <span key={line}>{line}</span>)}</address></details>
        </section>
      </div>
      <details className="ez-admin-options"><summary>Administrative test options</summary><label className="ez-check"><input checked={adminFaxTest} type="checkbox" onChange={(event) => setAdminFaxTest(event.currentTarget.checked)} /><span>Send this fax to the test number {ADMIN_TEST_FAX_NUMBER}</span></label></details>
      <div className="ez-form-actions"><button className="ez-button ez-button--secondary" type="button" onClick={onBack}>Back</button></div>
    </section>
  );
}
