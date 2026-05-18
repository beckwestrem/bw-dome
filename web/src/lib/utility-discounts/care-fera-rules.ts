import {
  PGE_CARE_FERA_ADDITIONAL_PERSON,
  PGE_CARE_FERA_THRESHOLDS,
} from "@/lib/utility-discounts/pge-care-fera-thresholds";
import type {
  EligibilityInput,
  EligibilityResult,
} from "@/lib/utility-discounts/types";
import { PGE_CARE_FERA_WORKFLOW } from "@/programs/pge_care_fera/workflow";

const DISCLAIMER =
  PGE_CARE_FERA_WORKFLOW.resultLanguageTemplates.notGuaranteeDisclaimer;

type RawEligibilityInput = Omit<
  Partial<EligibilityInput>,
  "utilityProvider"
> & {
  utilityProvider?: string;
};

function normalizeProvider(provider: string): EligibilityInput["utilityProvider"] {
  const cleaned = provider.trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (cleaned === "PGE" || cleaned === "PGELECTRIC" || cleaned === "PGEGAS") {
    return "PGE";
  }
  if (cleaned === "SCE") return "SCE";
  if (cleaned === "SDGE") return "SDGE";
  return "OTHER";
}

export function normalizeEligibilityInput(
  input: RawEligibilityInput,
): EligibilityInput {
  return {
    utilityProvider: normalizeProvider(input.utilityProvider ?? ""),
    zipCode: input.zipCode?.trim(),
    firstName: input.firstName?.trim(),
    lastName: input.lastName?.trim(),
    serviceAddress: input.serviceAddress?.trim(),
    phone: input.phone?.trim(),
    preferredLanguage: input.preferredLanguage?.trim(),
    householdSize: input.householdSize,
    annualGrossIncome: input.annualGrossIncome,
    assistancePrograms: input.assistancePrograms ?? [],
    billInUserName: input.billInUserName ?? false,
    isSubmeteredTenant: input.isSubmeteredTenant,
    isPastDue: input.isPastDue ?? false,
    monthlyBillAmount: input.monthlyBillAmount,
    email: input.email?.trim(),
  };
}

export function getPgeCareFeraThreshold(householdSize: number) {
  const normalizedSize = Math.max(1, Math.floor(householdSize));
  const tableSize = Math.min(Math.max(normalizedSize, 2), 8);
  const base = PGE_CARE_FERA_THRESHOLDS.find(
    (threshold) => threshold.householdSize === tableSize,
  );

  if (!base) {
    throw new Error("Missing PG&E CARE/FERA threshold configuration.");
  }

  if (normalizedSize <= 8) return base;

  const additionalPeople = normalizedSize - 8;
  return {
    householdSize: normalizedSize,
    careMax:
      base.careMax + additionalPeople * PGE_CARE_FERA_ADDITIONAL_PERSON.careMax,
    feraMin:
      base.feraMin + additionalPeople * PGE_CARE_FERA_ADDITIONAL_PERSON.feraMin,
    feraMax:
      base.feraMax + additionalPeople * PGE_CARE_FERA_ADDITIONAL_PERSON.feraMax,
  };
}

function withPastDueStep(input: EligibilityInput, nextSteps: string[]) {
  if (!input.isPastDue) return nextSteps;
  return [
    ...nextSteps,
    "Since the bill is past due, after CARE/FERA enrollment you may also want to check PG&E AMP debt forgiveness.",
  ];
}

export function checkPgeCareFeraEligibility(
  rawInput: RawEligibilityInput,
): EligibilityResult {
  const input = normalizeEligibilityInput(rawInput);

  if (input.utilityProvider !== "PGE") {
    return {
      supported: false,
      program: "NONE",
      confidence: "UNLIKELY",
      reasons: [
        "This first bill checkup only supports PG&E CARE/FERA in California.",
      ],
      nextSteps: [
        "Check your utility provider's website for its income-qualified discount programs.",
      ],
      disclaimer: DISCLAIMER,
    };
  }

  if (!input.householdSize || !input.annualGrossIncome) {
    return {
      supported: true,
      program: "REVIEW",
      confidence: "POSSIBLE",
      reasons: [
        "Household size and gross annual household income are needed to estimate CARE/FERA eligibility.",
      ],
      nextSteps: withPastDueStep(input, [
        "Add household size and annual gross income, then run the bill check again.",
        `You can also apply directly through PG&E's CARE/FERA application: ${PGE_CARE_FERA_WORKFLOW.applicationUrl}`,
      ]),
      disclaimer: DISCLAIMER,
    };
  }

  if (!input.billInUserName) {
    return {
      supported: true,
      program: "REVIEW",
      confidence: "POSSIBLE",
      reasons: [
        "The bill may need extra review because it is not in your name.",
        "CARE/FERA eligibility is tied to the household and utility account details PG&E verifies.",
      ],
      nextSteps: withPastDueStep(input, [
        "Check whether the person named on the bill can apply, or ask PG&E what documentation is needed.",
        `Start with PG&E's CARE/FERA application: ${PGE_CARE_FERA_WORKFLOW.applicationUrl}`,
      ]),
      disclaimer: DISCLAIMER,
    };
  }

  if (input.assistancePrograms.length > 0) {
    return {
      supported: true,
      program: "CARE",
      confidence: "LIKELY",
      reasons: [
        "Participation in a qualifying public assistance program may qualify the household for CARE.",
      ],
      nextSteps: withPastDueStep(input, [
        "Apply through PG&E's CARE/FERA application.",
        "Have your PG&E bill and proof of program participation ready.",
      ]),
      disclaimer: DISCLAIMER,
    };
  }

  const threshold = getPgeCareFeraThreshold(input.householdSize);

  if (input.annualGrossIncome <= threshold.careMax) {
    return {
      supported: true,
      program: "CARE",
      confidence: "LIKELY",
      reasons: [
        "Your household size and gross annual income appear to be within the CARE range.",
      ],
      nextSteps: withPastDueStep(input, [
        "Apply through PG&E's CARE/FERA application.",
        "Have your PG&E bill and income information ready.",
      ]),
      disclaimer: DISCLAIMER,
    };
  }

  if (
    input.annualGrossIncome >= threshold.feraMin &&
    input.annualGrossIncome <= threshold.feraMax
  ) {
    return {
      supported: true,
      program: "FERA",
      confidence: "LIKELY",
      reasons: [
        "Your household size and gross annual income appear to be above the CARE range and within the FERA range.",
      ],
      nextSteps: withPastDueStep(input, [
        "Apply through PG&E's shared CARE/FERA application.",
        "Have your PG&E bill and income information ready.",
      ]),
      disclaimer: DISCLAIMER,
    };
  }

  return {
    supported: true,
    program: "NONE",
    confidence: "UNLIKELY",
    reasons: [
      "Based on the household size and income entered, this household appears to be above the current CARE/FERA income ranges.",
    ],
    nextSteps: withPastDueStep(input, [
      "Review your income estimate before deciding not to apply.",
      "If your income changes month to month, PG&E may ask for current income details rather than last year's total.",
    ]),
    disclaimer: DISCLAIMER,
  };
}
