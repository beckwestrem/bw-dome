import {
  LADWP_EZ_SAVE_WORKFLOW,
} from "./workflow";
import type {
  LadwpEzSaveEligibilityResult,
  LadwpEzSaveInput,
} from "./types";

export const LADWP_EZ_SAVE_THRESHOLDS = {
  effectiveDate: "2025-07-01",
  lastVerifiedDate: "2026-07-15",
  sourceUrl:
    "https://www.ladwp.com/residential-services/assistance-programs/ez-save-program",
  annualReviewNote:
    "Income thresholds and program rules should be reviewed annually.",
  additionalPersonAmount: 11000,
  householdMaxIncome: {
    1: 42300,
    2: 42300,
    3: 53300,
    4: 64300,
    5: 75300,
    6: 86300,
    7: 97300,
    8: 108300,
  },
} as const;

const templates = LADWP_EZ_SAVE_WORKFLOW.resultLanguageTemplates;

export function normalizeLadwpEzSaveInput(
  input: Partial<LadwpEzSaveInput>,
): LadwpEzSaveInput {
  return {
    utilityProvider: input.utilityProvider?.trim() || "",
    isLadwpCustomer: input.isLadwpCustomer,
    zipCode: input.zipCode?.trim(),
    firstName: input.firstName?.trim(),
    lastName: input.lastName?.trim(),
    middleInitial: input.middleInitial?.trim(),
    serviceAddressStreetNumber: input.serviceAddressStreetNumber?.trim(),
    serviceAddressStreetName: input.serviceAddressStreetName?.trim(),
    apartmentNumber: input.apartmentNumber?.trim(),
    phone: input.phone?.trim(),
    mobilePhone: input.mobilePhone?.trim(),
    householdTotal: normalizeNumber(input.householdTotal),
    householdAdults: normalizeNumber(input.householdAdults),
    householdChildren: normalizeNumber(input.householdChildren),
    annualGrossHouseholdIncome: normalizeNumber(
      input.annualGrossHouseholdIncome,
    ),
    isCustomerOfRecord: input.isCustomerOfRecord,
    isPrimaryResidence: input.isPrimaryResidence,
    claimedAsDependent: input.claimedAsDependent,
    newApplicationOrRenewal: input.newApplicationOrRenewal,
    consentToPrepareApplication: input.consentToPrepareApplication,
    email: input.email?.trim(),
    accountNumber: input.includeAccountNumberInDraft
      ? input.accountNumber?.trim()
      : undefined,
    includeAccountNumberInDraft: input.includeAccountNumberInDraft,
    monthlyBillAmount: normalizeNumber(input.monthlyBillAmount),
    pastDueStatus: input.pastDueStatus,
    consentToContact: input.consentToContact,
  };
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function calculateHouseholdSize(input: LadwpEzSaveInput) {
  if (input.householdTotal && input.householdTotal > 0) return input.householdTotal;
  const adults = input.householdAdults;
  const children = input.householdChildren;
  if (adults === undefined || children === undefined) return undefined;
  const calculated = adults + children;
  return calculated > 0 ? calculated : undefined;
}

export function getLadwpEzSaveIncomeLimit(householdSize: number) {
  const normalized = Math.max(1, Math.floor(householdSize));
  if (normalized <= 8) {
    return LADWP_EZ_SAVE_THRESHOLDS.householdMaxIncome[
      normalized as keyof typeof LADWP_EZ_SAVE_THRESHOLDS.householdMaxIncome
    ];
  }
  return (
    LADWP_EZ_SAVE_THRESHOLDS.householdMaxIncome[8] +
    (normalized - 8) * LADWP_EZ_SAVE_THRESHOLDS.additionalPersonAmount
  );
}

export function checkLadwpEzSaveEligibility(
  rawInput: Partial<LadwpEzSaveInput>,
): LadwpEzSaveEligibilityResult {
  const input = normalizeLadwpEzSaveInput(rawInput);
  const utility = input.utilityProvider.toUpperCase().replace(/[^A-Z]/g, "");
  const reasons: string[] = [];
  const warnings = [
    templates.notGuaranteeDisclaimer,
    templates.noIncomeProof,
  ];

  if (utility !== "LADWP" || input.isLadwpCustomer === false) {
    return {
      status: "UNSUPPORTED_NOT_LADWP",
      confidence: "UNLIKELY",
      reasons: [templates.notLadwp],
      nextSteps: ["Check your own utility's discount programs."],
      warnings,
    };
  }

  if (input.isCustomerOfRecord === false) {
    return {
      status: "UNSUPPORTED_NOT_CUSTOMER_OF_RECORD",
      confidence: "POSSIBLE",
      reasons: [templates.customerOfRecordIssue],
      nextSteps: [
        "Review LADWP's official instructions before applying.",
        "If the bill is in someone else's name, ask the customer of record to review EZ-SAVE.",
      ],
      warnings,
    };
  }

  if (input.isPrimaryResidence === false) {
    return {
      status: "UNSUPPORTED_NOT_PRIMARY_RESIDENCE",
      confidence: "UNLIKELY",
      reasons: [templates.primaryResidenceIssue],
      nextSteps: ["Review LADWP's official eligibility rules before applying."],
      warnings,
    };
  }

  if (input.claimedAsDependent === true) {
    return {
      status: "UNSUPPORTED_DEPENDENT",
      confidence: "UNLIKELY",
      reasons: [templates.dependentIssue],
      nextSteps: ["Review this tax-return requirement before applying."],
      warnings,
    };
  }

  const householdSize = calculateHouseholdSize(input);
  if (!householdSize || input.annualGrossHouseholdIncome === undefined) {
    return {
      status: "SUPPORTED_POSSIBLY_ELIGIBLE_NEEDS_REVIEW",
      confidence: "POSSIBLE",
      reasons: [
        "Household size and gross annual household income are needed for an EZ-SAVE estimate.",
      ],
      nextSteps: [
        "Add household size and income, then run the check again.",
        "You can still prepare an application draft and review missing fields.",
      ],
      warnings,
    };
  }

  const incomeLimit = getLadwpEzSaveIncomeLimit(householdSize);
  reasons.push(
    `For a household of ${householdSize}, the current EZ-SAVE income limit is $${incomeLimit.toLocaleString()}.`,
  );

  if (input.annualGrossHouseholdIncome <= incomeLimit) {
    return {
      status: "SUPPORTED_LIKELY_ELIGIBLE",
      confidence: "LIKELY",
      reasons: [
        ...reasons,
        "Your gross annual household income is at or below the current limit entered for this household size.",
      ],
      nextSteps: [
        "Prepare your EZ-SAVE application draft.",
        "Review every answer before applying through LADWP.",
      ],
      warnings,
    };
  }

  return {
    status: "SUPPORTED_UNLIKELY_ELIGIBLE",
    confidence: "UNLIKELY",
    reasons: [
      ...reasons,
      "The income entered is above the current EZ-SAVE income limit for this household size.",
    ],
    nextSteps: [
      "Review the income amount before deciding not to apply.",
      "Check LADWP's official page for other assistance programs.",
    ],
    warnings,
  };
}
