import {
  PGE_CARE_FERA_WORKFLOW,
  getPgeCareFeraField,
} from "@/programs/pge_care_fera/workflow";
import type {
  EligibilityInput,
  FieldValue,
  FormCompletionDraft,
  FormCompletionDraftField,
} from "@/lib/utility-discounts/types";

export interface FormDraftService {
  createDraft(input: EligibilityInput): Promise<FormCompletionDraft>;
}

function cleanString(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function pushField(
  fields: FormCompletionDraftField[],
  missingFields: string[],
  fieldKey: string,
  value: FieldValue | undefined,
  needsReview = true,
) {
  const definition = getPgeCareFeraField(fieldKey);
  if (!definition) return;

  const isMissing =
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0 && definition.required);

  if (isMissing) {
    if (definition.required) missingFields.push(fieldKey);
    return;
  }

  fields.push({
    fieldKey,
    value,
    confidence: definition.requiresUserConfirmation ? "medium" : "high",
    source: "user_answer",
    needsReview: needsReview || definition.requiresUserConfirmation,
  });
}

export class RulesBasedFormDraftService implements FormDraftService {
  async createDraft(input: EligibilityInput): Promise<FormCompletionDraft> {
    const fields: FormCompletionDraftField[] = [];
    const missingFields: string[] = [];

    pushField(fields, missingFields, "first_name", cleanString(input.firstName));
    pushField(fields, missingFields, "last_name", cleanString(input.lastName));
    pushField(
      fields,
      missingFields,
      "service_address",
      cleanString(input.serviceAddress),
    );
    pushField(fields, missingFields, "zip_code", cleanString(input.zipCode));
    pushField(fields, missingFields, "email", cleanString(input.email));
    pushField(fields, missingFields, "phone", cleanString(input.phone));
    pushField(
      fields,
      missingFields,
      "preferred_language",
      cleanString(input.preferredLanguage),
    );
    pushField(fields, missingFields, "household_size", input.householdSize);
    pushField(
      fields,
      missingFields,
      "annual_gross_income",
      input.annualGrossIncome,
    );
    pushField(
      fields,
      missingFields,
      "assistance_programs",
      input.assistancePrograms,
    );
    pushField(fields, missingFields, "utility_provider", input.utilityProvider);
    pushField(
      fields,
      missingFields,
      "bill_in_user_name",
      input.billInUserName,
    );
    pushField(
      fields,
      missingFields,
      "is_submetered_tenant",
      input.isSubmeteredTenant,
    );
    pushField(fields, missingFields, "is_past_due", input.isPastDue);

    return {
      programId: PGE_CARE_FERA_WORKFLOW.programId,
      fields,
      missingFields,
      warnings: [
        PGE_CARE_FERA_WORKFLOW.resultLanguageTemplates.notGuaranteeDisclaimer,
        "This is an application prep tool. Review all answers before submitting anything to PG&E.",
        "Do not add SSNs or full utility account numbers here.",
      ],
    };
  }
}

export class LLMFormDraftService implements FormDraftService {
  async createDraft(): Promise<FormCompletionDraft> {
    throw new Error(
      "LLM form drafting is intentionally disabled until a reviewed workflow-specific prompt and JSON schema are added.",
    );
  }
}
