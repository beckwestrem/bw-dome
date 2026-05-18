export type LadwpEzSaveEligibilityStatus =
  | "SUPPORTED_LIKELY_ELIGIBLE"
  | "SUPPORTED_POSSIBLY_ELIGIBLE_NEEDS_REVIEW"
  | "SUPPORTED_UNLIKELY_ELIGIBLE"
  | "UNSUPPORTED_NOT_LADWP"
  | "UNSUPPORTED_NOT_CUSTOMER_OF_RECORD"
  | "UNSUPPORTED_NOT_PRIMARY_RESIDENCE"
  | "UNSUPPORTED_DEPENDENT";

export type LadwpEzSaveConfidence = "LIKELY" | "POSSIBLE" | "UNLIKELY";

export type LadwpEzSaveInput = {
  utilityProvider: string;
  isLadwpCustomer?: boolean;
  zipCode?: string;
  firstName?: string;
  lastName?: string;
  middleInitial?: string;
  serviceAddressStreetNumber?: string;
  serviceAddressStreetName?: string;
  apartmentNumber?: string;
  phone?: string;
  mobilePhone?: string;
  householdTotal?: number;
  householdAdults?: number;
  householdChildren?: number;
  annualGrossHouseholdIncome?: number;
  isCustomerOfRecord?: boolean;
  isPrimaryResidence?: boolean;
  claimedAsDependent?: boolean;
  newApplicationOrRenewal?: "new_application" | "renewal";
  consentToPrepareApplication?: boolean;
  userCertifiesReviewRequired?: boolean;
  email?: string;
  accountNumber?: string;
  includeAccountNumberInDraft?: boolean;
  monthlyBillAmount?: number;
  pastDueStatus?: boolean;
  consentToContact?: boolean;
};

export type LadwpEzSaveEligibilityResult = {
  status: LadwpEzSaveEligibilityStatus;
  confidence: LadwpEzSaveConfidence;
  reasons: string[];
  nextSteps: string[];
  warnings: string[];
};

export type LadwpEzSaveDraftField = {
  fieldKey: string;
  label: string;
  value: string | number | boolean | null;
  source: "user_answer" | "uploaded_bill" | "manual_edit" | "prior_session_state";
  confidence: "high" | "medium" | "low";
  needsReview: boolean;
  required: boolean;
};

export type LadwpEzSaveApplicationDraft = {
  programId: "ladwp_ez_save";
  programName: "LADWP EZ-SAVE";
  result: LadwpEzSaveEligibilityResult;
  fields: LadwpEzSaveDraftField[];
  missingFields: string[];
  warnings: string[];
  nextSteps: string[];
};

export type LadwpEzSaveWorkflowField = {
  fieldKey: string;
  label: string;
  type: "text" | "number" | "boolean" | "select";
  required: boolean;
  recommended?: boolean;
  allowedValues?: string[];
  userHelpText: string;
  sourcePriority: string[];
  canLlmFill: boolean;
  requiresUserConfirmation: boolean;
  validation: string;
};
