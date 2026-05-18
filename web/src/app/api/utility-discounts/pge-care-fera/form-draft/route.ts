import { NextResponse } from "next/server";

import { normalizeEligibilityInput } from "@/lib/utility-discounts/care-fera-rules";
import { RulesBasedFormDraftService } from "@/lib/utility-discounts/form-draft-service";

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const input = normalizeEligibilityInput({
      utilityProvider: optionalString(body.utilityProvider),
      zipCode: optionalString(body.zipCode),
      firstName: optionalString(body.firstName),
      lastName: optionalString(body.lastName),
      serviceAddress: optionalString(body.serviceAddress),
      phone: optionalString(body.phone),
      preferredLanguage: optionalString(body.preferredLanguage),
      householdSize: optionalNumber(body.householdSize),
      annualGrossIncome: optionalNumber(body.annualGrossIncome),
      assistancePrograms: Array.isArray(body.assistancePrograms)
        ? body.assistancePrograms.filter(
            (program): program is string => typeof program === "string",
          )
        : [],
      billInUserName: body.billInUserName === true,
      isSubmeteredTenant: optionalBoolean(body.isSubmeteredTenant),
      isPastDue: body.isPastDue === true,
      monthlyBillAmount: optionalNumber(body.monthlyBillAmount),
      email: optionalString(body.email),
    });

    const service = new RulesBasedFormDraftService();
    const draft = await service.createDraft(input);

    return NextResponse.json(draft);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    console.error("[utility-discounts/pge-care-fera/form-draft]", message);
    return NextResponse.json(
      { error: "Could not prepare the form draft right now." },
      { status: 500 },
    );
  }
}
