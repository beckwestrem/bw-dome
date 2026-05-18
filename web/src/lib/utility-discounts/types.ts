export type UtilityProvider = "PGE" | "SCE" | "SDGE" | "OTHER";

export type UtilityDiscountProgram = "CARE" | "FERA" | "REVIEW" | "NONE";

export type EligibilityConfidence = "LIKELY" | "POSSIBLE" | "UNLIKELY";

export type EligibilityInput = {
  utilityProvider: UtilityProvider;
  zipCode?: string;
  firstName?: string;
  lastName?: string;
  serviceAddress?: string;
  phone?: string;
  preferredLanguage?: string;
  householdSize?: number;
  annualGrossIncome?: number;
  assistancePrograms: string[];
  billInUserName: boolean;
  isSubmeteredTenant?: boolean;
  isPastDue: boolean;
  monthlyBillAmount?: number;
  email?: string;
};

export type EligibilityResult = {
  supported: boolean;
  program: UtilityDiscountProgram;
  confidence: EligibilityConfidence;
  reasons: string[];
  nextSteps: string[];
  disclaimer: string;
};

export type FieldValue = string | number | boolean | string[] | null;

export type FieldSource =
  | "user_answer"
  | "uploaded_bill"
  | "prior_profile"
  | "manual_entry";

export type DraftConfidence = "high" | "medium" | "low";

export type FieldDefinition = {
  fieldKey: string;
  label: string;
  type: "text" | "number" | "boolean" | "select" | "multiselect";
  required: boolean;
  allowedValues?: string[];
  sourcePriority: FieldSource[];
  validation: string;
  canLlmFill: boolean;
  requiresUserConfirmation: boolean;
  userHelpText: string;
};

export type ProgramWorkflowDefinition = {
  programId: "pge_care_fera";
  displayName: string;
  utility: "PG&E";
  state: "CA";
  programType: "utility_discount";
  supportedStatus: "mvp_supported";
  lastVerifiedDate: string | null;
  sourceUrls: string[];
  annualReviewNote: string;
  supportedFlow: "application_prep";
  applicationUrl: string;
  workflowSummary: string;
  requiredUserInputs: string[];
  optionalUserInputs: string[];
  formSections: { title: string; fieldKeys: string[] }[];
  fieldDefinitions: FieldDefinition[];
  validationRules: string[];
  sensitiveFieldsBlocklist: string[];
  fieldMappingRules: Record<
    string,
    {
      allowedSources: Array<
        | "user_answer"
        | "uploaded_utility_bill"
        | "manual_edit"
        | "prior_session_state"
        | "llm_extraction"
      >;
      llmRule: string;
    }
  >;
  llmInstructions: string[];
  resultLanguageTemplates: Record<string, string>;
  nextSteps: string[];
  unsupportedConditions: string[];
  officialApplicationHandoff: {
    applicationUrl: string;
    checklistItems: string[];
    reviewBeforeSubmitRequired: true;
    autoSubmitAllowed: false;
  };
  extensionPayloadSchema: {
    programId: string;
    applicationUrl: string;
    fields: FormCompletionDraftField[];
    missingFields: string[];
    warnings: string[];
  };
};

export type FormCompletionDraftField = {
  fieldKey: string;
  value: FieldValue;
  confidence: DraftConfidence;
  source: FieldSource;
  needsReview: boolean;
};

export type FormCompletionDraft = {
  programId: "pge_care_fera";
  fields: FormCompletionDraftField[];
  missingFields: string[];
  warnings: string[];
};
