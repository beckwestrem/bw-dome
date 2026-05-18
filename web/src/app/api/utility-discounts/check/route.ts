import { NextResponse } from "next/server";

import { checkPgeCareFeraEligibility } from "@/lib/utility-discounts/care-fera-rules";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const result = checkPgeCareFeraEligibility({
      utilityProvider:
        typeof body.utilityProvider === "string" ? body.utilityProvider : "",
      zipCode: typeof body.zipCode === "string" ? body.zipCode : undefined,
      firstName: typeof body.firstName === "string" ? body.firstName : undefined,
      lastName: typeof body.lastName === "string" ? body.lastName : undefined,
      serviceAddress:
        typeof body.serviceAddress === "string" ? body.serviceAddress : undefined,
      phone: typeof body.phone === "string" ? body.phone : undefined,
      preferredLanguage:
        typeof body.preferredLanguage === "string"
          ? body.preferredLanguage
          : undefined,
      householdSize:
        typeof body.householdSize === "number" ? body.householdSize : undefined,
      annualGrossIncome:
        typeof body.annualGrossIncome === "number"
          ? body.annualGrossIncome
          : undefined,
      assistancePrograms: Array.isArray(body.assistancePrograms)
        ? body.assistancePrograms.filter(
            (program): program is string => typeof program === "string",
          )
        : [],
      billInUserName: body.billInUserName === true,
      isSubmeteredTenant:
        typeof body.isSubmeteredTenant === "boolean"
          ? body.isSubmeteredTenant
          : undefined,
      isPastDue: body.isPastDue === true,
      monthlyBillAmount:
        typeof body.monthlyBillAmount === "number"
          ? body.monthlyBillAmount
          : undefined,
      email: typeof body.email === "string" ? body.email : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    console.error("[utility-discounts/check]", message);
    return NextResponse.json(
      { error: "Could not check eligibility right now." },
      { status: 500 },
    );
  }
}
