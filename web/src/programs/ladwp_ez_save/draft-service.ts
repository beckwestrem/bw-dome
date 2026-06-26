import {
  LADWP_EZ_SAVE_FIELDS,
  LADWP_EZ_SAVE_WORKFLOW,
  getLadwpEzSaveField,
} from "./workflow";
import {
  checkLadwpEzSaveEligibility,
  normalizeLadwpEzSaveInput,
} from "./rules";
import type {
  LadwpEzSaveApplicationDraft,
  LadwpEzSaveDraftField,
  LadwpEzSaveInput,
} from "./types";

type FieldValue = string | number | boolean | null | undefined;

export interface ApplicationDraftService {
  createDraft(input: Partial<LadwpEzSaveInput>): Promise<LadwpEzSaveApplicationDraft>;
}

function addField(
  fields: LadwpEzSaveDraftField[],
  missingFields: string[],
  fieldKey: string,
  value: FieldValue,
) {
  const definition = getLadwpEzSaveField(fieldKey);
  if (!definition) return;

  const missing = value === undefined || value === null || value === "";
  if (missing) {
    if (definition.required) missingFields.push(fieldKey);
    return;
  }

  fields.push({
    fieldKey,
    label: definition.label,
    value,
    source: "user_answer",
    confidence: definition.requiresUserConfirmation ? "medium" : "high",
    needsReview: definition.requiresUserConfirmation,
    required: definition.required,
  });
}

export class RulesBasedEzSaveDraftService implements ApplicationDraftService {
  async createDraft(
    rawInput: Partial<LadwpEzSaveInput>,
  ): Promise<LadwpEzSaveApplicationDraft> {
    const input = normalizeLadwpEzSaveInput(rawInput);
    const result = checkLadwpEzSaveEligibility(input);
    const fields: LadwpEzSaveDraftField[] = [];
    const missingFields: string[] = [];

    for (const field of LADWP_EZ_SAVE_FIELDS) {
      addField(fields, missingFields, field.fieldKey, valueForField(input, field.fieldKey));
    }

    return {
      programId: "ladwp_ez_save",
      programName: "LADWP EZ-SAVE",
      result,
      fields,
      missingFields,
      warnings: [
        ...result.warnings,
        LADWP_EZ_SAVE_WORKFLOW.resultLanguageTemplates.privacyDisclaimer,
        LADWP_EZ_SAVE_WORKFLOW.resultLanguageTemplates.signatureReminder,
      ],
      nextSteps: [
        "Review and edit each answer.",
        "Copy your answers or continue to LADWP.",
        "Sign before submitting if you use a paper application.",
      ],
    };
  }
}

function valueForField(input: LadwpEzSaveInput, fieldKey: string): FieldValue {
  switch (fieldKey) {
    case "utility_provider":
      return input.utilityProvider || "LADWP";
    case "is_ladwp_customer":
      return input.isLadwpCustomer;
    case "zip_code":
      return input.zipCode;
    case "first_name":
      return input.firstName;
    case "last_name":
      return input.lastName;
    case "middle_initial":
      return input.middleInitial;
    case "service_address_street_number":
      return input.serviceAddressStreetNumber;
    case "service_address_street_name":
      return input.serviceAddressStreetName;
    case "apartment_number":
      return input.apartmentNumber;
    case "phone":
      return input.phone;
    case "mobile_phone":
      return input.mobilePhone;
    case "household_total":
      return input.householdTotal;
    case "household_adults":
      return input.householdAdults;
    case "household_children":
      return input.householdChildren;
    case "annual_gross_household_income":
      return input.annualGrossHouseholdIncome;
    case "is_customer_of_record":
      return input.isCustomerOfRecord;
    case "is_primary_residence":
      return input.isPrimaryResidence;
    case "claimed_as_dependent":
      return input.claimedAsDependent;
    case "new_application_or_renewal":
      return input.newApplicationOrRenewal;
    case "email":
      return input.email;
    case "account_number":
      return input.accountNumber;
    case "monthly_bill_amount":
      return input.monthlyBillAmount;
    case "past_due_status":
      return input.pastDueStatus;
    case "consent_to_prepare_application":
      return input.consentToPrepareApplication;
    default:
      return undefined;
  }
}
