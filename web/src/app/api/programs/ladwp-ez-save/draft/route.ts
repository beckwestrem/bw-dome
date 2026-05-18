import { NextResponse } from "next/server";

import { RulesBasedEzSaveDraftService } from "@/programs/ladwp_ez_save/draft-service";
import type { LadwpEzSaveInput } from "@/programs/ladwp_ez_save/types";

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function parseBody(body: Record<string, unknown>): Partial<LadwpEzSaveInput> {
  return {
    utilityProvider: stringValue(body.utilityProvider) ?? "",
    isLadwpCustomer: booleanValue(body.isLadwpCustomer),
    zipCode: stringValue(body.zipCode),
    firstName: stringValue(body.firstName),
    lastName: stringValue(body.lastName),
    middleInitial: stringValue(body.middleInitial),
    serviceAddressStreetNumber: stringValue(body.serviceAddressStreetNumber),
    serviceAddressStreetName: stringValue(body.serviceAddressStreetName),
    apartmentNumber: stringValue(body.apartmentNumber),
    phone: stringValue(body.phone),
    mobilePhone: stringValue(body.mobilePhone),
    householdTotal: numberValue(body.householdTotal),
    householdAdults: numberValue(body.householdAdults),
    householdChildren: numberValue(body.householdChildren),
    annualGrossHouseholdIncome: numberValue(body.annualGrossHouseholdIncome),
    isCustomerOfRecord: booleanValue(body.isCustomerOfRecord),
    isPrimaryResidence: booleanValue(body.isPrimaryResidence),
    claimedAsDependent: booleanValue(body.claimedAsDependent),
    newApplicationOrRenewal:
      body.newApplicationOrRenewal === "renewal" ? "renewal" : "new_application",
    consentToPrepareApplication: booleanValue(body.consentToPrepareApplication),
    userCertifiesReviewRequired: booleanValue(body.userCertifiesReviewRequired),
    email: stringValue(body.email),
    includeAccountNumberInDraft: booleanValue(body.includeAccountNumberInDraft),
    accountNumber: stringValue(body.accountNumber),
    monthlyBillAmount: numberValue(body.monthlyBillAmount),
    pastDueStatus: booleanValue(body.pastDueStatus),
    consentToContact: booleanValue(body.consentToContact),
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const service = new RulesBasedEzSaveDraftService();
    return NextResponse.json(await service.createDraft(parseBody(body)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    console.error("[ladwp-ez-save/draft]", message);
    return NextResponse.json(
      { error: "Could not prepare your EZ-SAVE draft right now." },
      { status: 500 },
    );
  }
}
