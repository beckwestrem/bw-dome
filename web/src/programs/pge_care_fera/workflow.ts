import type { ProgramWorkflowDefinition } from "@/lib/utility-discounts/types";

export const PGE_CARE_FERA_APPLICATION_URL =
  "https://www.pge.com/carefera/";

export const PGE_CARE_FERA_SOURCE_URLS = [
  "https://www.pge.com/carefera/",
  "https://www.pge.com/en/account/billing-and-assistance/financial-assistance/family-electric-rate-assistance-program-fera.html",
] as const;

export const QUALIFYING_ASSISTANCE_PROGRAMS = [
  "Medi-Cal / Medicaid",
  "CalFresh / SNAP",
  "CalWORKs / TANF",
  "SSI",
  "WIC",
  "LIHEAP",
  "National School Lunch Program",
  "Bureau of Indian Affairs General Assistance",
  "Head Start Income Eligible",
  "Tribal TANF",
  "Food Distribution Program on Indian Reservations",
] as const;

export const PGE_CARE_FERA_REQUIRED_FIELDS = [
  "utility_provider",
  "zip_code",
  "household_size",
  "annual_gross_income",
  "assistance_programs",
  "bill_in_user_name",
  "is_past_due",
] as const;

export const PGE_CARE_FERA_CHECKLIST_ITEMS = [
  "Your PG&E bill or online account access",
  "Household size",
  "Gross household income before taxes",
  "Proof of qualifying assistance program, if you use one",
  "The name on the utility bill",
] as const;

const fieldMappingRules = Object.fromEntries(
  [
    "utility_provider",
    "zip_code",
    "household_size",
    "annual_gross_income",
    "assistance_programs",
    "bill_in_user_name",
    "is_past_due",
    "email",
    "phone",
    "service_address",
    "preferred_language",
    "first_name",
    "last_name",
    "is_submetered_tenant",
  ].map((fieldKey) => [
    fieldKey,
    {
      allowedSources: [
        "user_answer",
        "uploaded_utility_bill",
        "manual_edit",
        "prior_session_state",
        "llm_extraction",
      ],
      llmRule:
        "The LLM may fill this field only when the value is directly supported by user-provided data; otherwise mark it missing.",
    },
  ]),
) as ProgramWorkflowDefinition["fieldMappingRules"];

export const PGE_CARE_FERA_WORKFLOW: ProgramWorkflowDefinition = {
  programId: "pge_care_fera",
  displayName: "PG&E CARE/FERA",
  utility: "PG&E",
  state: "CA",
  programType: "utility_discount",
  supportedStatus: "mvp_supported",
  lastVerifiedDate: "2026-05-18",
  sourceUrls: [...PGE_CARE_FERA_SOURCE_URLS],
  annualReviewNote:
    "Income thresholds and program rules should be reviewed annually.",
  supportedFlow: "application_prep",
  applicationUrl: PGE_CARE_FERA_APPLICATION_URL,
  workflowSummary:
    "CARE/FERA is a PG&E utility bill discount program. This app estimates eligibility and prepares the application, but the user must review answers before submitting. The app does not guarantee approval and does not submit the application automatically.",
  requiredUserInputs: [...PGE_CARE_FERA_REQUIRED_FIELDS],
  optionalUserInputs: [
    "first_name",
    "last_name",
    "service_address",
    "email",
    "phone",
    "preferred_language",
    "is_submetered_tenant",
  ],
  formSections: [
    {
      title: "Customer details",
      fieldKeys: [
        "first_name",
        "last_name",
        "service_address",
        "zip_code",
        "email",
        "phone",
        "preferred_language",
      ],
    },
    {
      title: "Household and utility",
      fieldKeys: [
        "utility_provider",
        "bill_in_user_name",
        "household_size",
        "annual_gross_income",
        "assistance_programs",
        "is_submetered_tenant",
        "is_past_due",
      ],
    },
  ],
  fieldDefinitions: [
    {
      fieldKey: "first_name",
      label: "First name",
      type: "text",
      required: false,
      sourcePriority: ["user_answer", "manual_entry"],
      validation: "Non-empty text if provided.",
      canLlmFill: false,
      requiresUserConfirmation: true,
      userHelpText:
        "Use the legal or preferred first name PG&E expects for the application.",
    },
    {
      fieldKey: "last_name",
      label: "Last name",
      type: "text",
      required: false,
      sourcePriority: ["user_answer", "manual_entry"],
      validation: "Non-empty text if provided.",
      canLlmFill: false,
      requiresUserConfirmation: true,
      userHelpText: "Use the last name PG&E expects for the application.",
    },
    {
      fieldKey: "service_address",
      label: "Service address",
      type: "text",
      required: false,
      sourcePriority: ["user_answer", "uploaded_bill", "manual_entry"],
      validation: "Street address text if provided.",
      canLlmFill: true,
      requiresUserConfirmation: true,
      userHelpText:
        "This should match the address where PG&E service is delivered.",
    },
    {
      fieldKey: "zip_code",
      label: "Service ZIP code",
      type: "text",
      required: true,
      sourcePriority: ["user_answer", "uploaded_bill", "manual_entry"],
      validation: "Five-digit ZIP code.",
      canLlmFill: true,
      requiresUserConfirmation: true,
      userHelpText: "Use the ZIP code for the PG&E service address.",
    },
    {
      fieldKey: "email",
      label: "Email",
      type: "text",
      required: false,
      sourcePriority: ["user_answer", "manual_entry"],
      validation: "Valid email address if provided.",
      canLlmFill: false,
      requiresUserConfirmation: true,
      userHelpText: "PG&E may use this to contact you about the application.",
    },
    {
      fieldKey: "phone",
      label: "Phone",
      type: "text",
      required: false,
      sourcePriority: ["user_answer", "manual_entry"],
      validation: "Phone number text if provided.",
      canLlmFill: false,
      requiresUserConfirmation: true,
      userHelpText: "Use a phone number where PG&E can reach you.",
    },
    {
      fieldKey: "preferred_language",
      label: "Preferred language",
      type: "select",
      required: false,
      allowedValues: ["English", "Spanish", "Chinese", "Tagalog", "Other"],
      sourcePriority: ["user_answer", "manual_entry"],
      validation: "One supported language value if provided.",
      canLlmFill: true,
      requiresUserConfirmation: true,
      userHelpText:
        "Choose the language you prefer for application help or notices.",
    },
    {
      fieldKey: "household_size",
      label: "Household size",
      type: "number",
      required: true,
      sourcePriority: ["user_answer", "manual_entry"],
      validation: "Whole number greater than zero.",
      canLlmFill: false,
      requiresUserConfirmation: true,
      userHelpText: "Count everyone in the household PG&E asks you to include.",
    },
    {
      fieldKey: "annual_gross_income",
      label: "Gross annual household income",
      type: "number",
      required: true,
      sourcePriority: ["user_answer", "manual_entry"],
      validation: "Non-negative annual income before taxes.",
      canLlmFill: false,
      requiresUserConfirmation: true,
      userHelpText: "Use total household income before taxes or deductions.",
    },
    {
      fieldKey: "assistance_programs",
      label: "Qualifying public assistance programs",
      type: "multiselect",
      required: false,
      allowedValues: [...QUALIFYING_ASSISTANCE_PROGRAMS],
      sourcePriority: ["user_answer", "manual_entry"],
      validation: "Known assistance program names.",
      canLlmFill: false,
      requiresUserConfirmation: true,
      userHelpText:
        "Select only programs someone in the household actually participates in.",
    },
    {
      fieldKey: "utility_provider",
      label: "Utility provider",
      type: "select",
      required: true,
      allowedValues: ["PGE", "SCE", "SDGE", "OTHER"],
      sourcePriority: ["user_answer", "uploaded_bill", "manual_entry"],
      validation: "Must be PG&E for this workflow.",
      canLlmFill: true,
      requiresUserConfirmation: true,
      userHelpText: "This workflow currently prepares PG&E CARE/FERA only.",
    },
    {
      fieldKey: "bill_in_user_name",
      label: "Bill is in your name",
      type: "boolean",
      required: true,
      sourcePriority: ["user_answer", "uploaded_bill", "manual_entry"],
      validation: "Boolean yes/no.",
      canLlmFill: false,
      requiresUserConfirmation: true,
      userHelpText:
        "If not, PG&E may need the account holder to apply or provide documentation.",
    },
    {
      fieldKey: "is_submetered_tenant",
      label: "Submetered tenant",
      type: "boolean",
      required: false,
      sourcePriority: ["user_answer", "manual_entry"],
      validation: "Boolean yes/no if known.",
      canLlmFill: false,
      requiresUserConfirmation: true,
      userHelpText:
        "Select yes only if a landlord or property bills you for PG&E service through a submeter.",
    },
    {
      fieldKey: "is_past_due",
      label: "Bill is past due",
      type: "boolean",
      required: true,
      sourcePriority: ["user_answer", "uploaded_bill", "manual_entry"],
      validation: "Boolean yes/no.",
      canLlmFill: true,
      requiresUserConfirmation: true,
      userHelpText:
        "This does not affect CARE/FERA eligibility, but it can shape follow-up options.",
    },
  ],
  validationRules: [
    "Do not invent identity, address, household, income, or assistance-program data.",
    "Eligibility must come from deterministic CARE/FERA rules, not LLM output.",
    "Missing required fields must be shown for user review.",
    "Do not auto-submit the PG&E application.",
  ],
  sensitiveFieldsBlocklist: [
    "SSN",
    "full utility account number",
    "bank account information",
    "raw income document storage",
    "government ID upload",
    "medical records",
    "immigration status",
  ],
  fieldMappingRules,
  llmInstructions: [
    "Never invent missing values.",
    "Never decide final eligibility.",
    "Never override deterministic rules.",
    "Never say the user is approved.",
    "Use likely eligible, may qualify, or needs review.",
    "Return structured JSON only.",
    "Mark low-confidence fields as needsReview.",
    "Always show the source of each field.",
    "If sensitive blocklisted data is provided accidentally, do not use it in the form draft unless a later verified workflow explicitly requires it.",
  ],
  resultLanguageTemplates: {
    likelyCareEligible: "Likely CARE eligible",
    likelyFeraEligible: "Likely FERA eligible",
    possiblyEligibleNeedsReview: "Possibly eligible, needs review",
    probablyNotEligible: "Probably not eligible",
    unsupportedUtility:
      "This first bill checkup only supports PG&E CARE/FERA in California.",
    pastDueAmpFollowOn:
      "Since the bill is past due, after CARE/FERA enrollment you may also want to check PG&E AMP debt forgiveness.",
    privacyDisclaimer:
      "We only use this information to estimate eligibility and prepare your form. Review all answers before submitting to PG&E.",
    notGuaranteeDisclaimer:
      "This is an eligibility estimate, not a guarantee of approval. PG&E makes the final eligibility decision.",
  },
  nextSteps: [
    "Review every drafted answer.",
    "Edit missing or incorrect fields.",
    "Open PG&E's CARE/FERA application and submit only after reviewing on PG&E's site.",
  ],
  unsupportedConditions: [
    "Utility provider is not PG&E.",
    "User wants automatic submission.",
    "User asks to use SSN or full utility account number in this app.",
  ],
  officialApplicationHandoff: {
    applicationUrl: PGE_CARE_FERA_APPLICATION_URL,
    checklistItems: [...PGE_CARE_FERA_CHECKLIST_ITEMS],
    reviewBeforeSubmitRequired: true,
    autoSubmitAllowed: false,
  },
  extensionPayloadSchema: {
    programId: "pge_care_fera",
    applicationUrl: PGE_CARE_FERA_APPLICATION_URL,
    fields: [
      {
        fieldKey: "household_size",
        value: 2,
        source: "user_answer",
        confidence: "high",
        needsReview: false,
      },
    ],
    missingFields: [],
    warnings: [],
  },
};

export function getPgeCareFeraField(fieldKey: string) {
  return PGE_CARE_FERA_WORKFLOW.fieldDefinitions.find(
    (field) => field.fieldKey === fieldKey,
  );
}
