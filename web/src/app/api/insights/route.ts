import { NextResponse } from "next/server";

import { sortAccountsByUrgency } from "@/lib/account-ranking";
import { buildActionItems } from "@/lib/insights";
import { resolveOwnerId } from "@/lib/request-owner";
import { readAppData } from "@/lib/storage";

export async function GET() {
  const ownerId = await resolveOwnerId();
  const data = await readAppData(ownerId);
  const actions = buildActionItems(data.accounts, data.transactions);
  const accountsRanked = sortAccountsByUrgency(data.accounts);

  const primaryCurrency = accountsRanked[0]?.currency ?? "USD";
  const bookTotal = data.accounts.reduce((sum, a) => sum + a.balance, 0);

  return NextResponse.json({
    highlights: [
      `${data.accounts.length} accounts in this upload.`,
      `${data.transactions.length} data rows read from the file.`,
      `Total value is ${new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: primaryCurrency,
      }).format(bookTotal)} — eyeball this against your source file if unsure.`,
    ],
    actions,
    accounts: accountsRanked,
    settings: data.settings,
  });
}
