import type {
  LadwpEzSaveBillExtractedField,
  LadwpEzSaveBillExtractionResult,
  LadwpEzSaveInput,
} from "./types";

export type BillExtractionInput = {
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
};

export interface BillExtractionService {
  extract(input: BillExtractionInput): Promise<LadwpEzSaveBillExtractionResult>;
}

function textDecoderInput(input: BillExtractionInput) {
  const lowerName = input.fileName.toLowerCase();
  if (
    input.contentType.startsWith("text/") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".csv")
  ) {
    return new TextDecoder("utf-8", { fatal: false }).decode(input.bytes);
  }
  return "";
}

function field(
  fieldKey: keyof LadwpEzSaveInput,
  value: string | number | boolean | undefined,
  confidence: LadwpEzSaveBillExtractedField["confidence"],
  evidence?: string,
): LadwpEzSaveBillExtractedField | null {
  if (value === undefined || value === "" || value === null) return null;
  return {
    fieldKey,
    value,
    confidence,
    source: "local_text_extraction",
    evidence,
  };
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1]?.trim();
    if (value) return { value, evidence: match[0].slice(0, 180) };
  }
  return null;
}

function normalizeMoney(value: string) {
  const parsed = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { firstName: parts[0] };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function splitAddress(address: string) {
  const match = address.match(/^(\d+[A-Za-z]?)\s+(.+?)(?:,\s*[A-Za-z .]+,\s*([A-Z]{2})\s+)?(\d{5})(?:-\d{4})?$/i);
  if (!match) return {};
  return {
    serviceAddressStreetNumber: match[1],
    serviceAddressStreetName: match[2],
    zipCode: match[4],
  };
}

export class LocalTextBillExtractionService implements BillExtractionService {
  async extract(input: BillExtractionInput): Promise<LadwpEzSaveBillExtractionResult> {
    const text = textDecoderInput(input);
    if (!text.trim()) {
      return {
        ok: false,
        provider: "local_text",
        fields: [],
        warnings: [
          "Bill upload received. PDF/image extraction needs an LLM or OCR provider before it can prefill fields.",
        ],
      };
    }

    const fields: LadwpEzSaveBillExtractedField[] = [];
    const utilityEvidence = /LADWP|Los Angeles Department of Water and Power/i.exec(text);
    if (utilityEvidence) {
      fields.push({
        fieldKey: "utilityProvider",
        value: "LADWP",
        confidence: "high",
        source: "local_text_extraction",
        evidence: utilityEvidence[0],
      });
      fields.push({
        fieldKey: "isLadwpCustomer",
        value: true,
        confidence: "medium",
        source: "local_text_extraction",
        evidence: utilityEvidence[0],
      });
    }

    const account = firstMatch(text, [
      /(?:account|acct)\s*(?:number|#|no\.?)\s*[:#]?\s*([A-Z0-9 -]{6,30})/i,
    ]);
    const name = firstMatch(text, [
      /(?:customer|account holder|name)\s*[:#]?\s*([^\n\r]+)/i,
    ]);
    const address = firstMatch(text, [
      /(?:service address|service location)\s*[:#]?\s*([^\n\r]+?\d{5}(?:-\d{4})?)/i,
    ]);
    const amount = firstMatch(text, [
      /(?:amount due|total amount due|current charges|new charges)\s*[:#]?\s*(\$?\s*\d[\d,]*(?:\.\d{2})?)/i,
    ]);
    const phone = firstMatch(text, [
      /(?:phone|telephone)\s*[:#]?\s*(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/i,
    ]);

    const candidates = [
      field("accountNumber", account?.value.replace(/\s/g, ""), "medium", account?.evidence),
      field("monthlyBillAmount", amount ? normalizeMoney(amount.value) : undefined, "medium", amount?.evidence),
      field("phone", phone?.value, "low", phone?.evidence),
    ];

    if (name) {
      const split = splitName(name.value);
      candidates.push(
        field("firstName", split.firstName, "low", name.evidence),
        field("lastName", split.lastName, "low", name.evidence),
      );
    }

    if (address) {
      const split = splitAddress(address.value);
      candidates.push(
        field("serviceAddressStreetNumber", split.serviceAddressStreetNumber, "medium", address.evidence),
        field("serviceAddressStreetName", split.serviceAddressStreetName, "medium", address.evidence),
        field("zipCode", split.zipCode, "medium", address.evidence),
      );
    }

    for (const candidate of candidates) {
      if (candidate) fields.push(candidate);
    }

    if (/past due|overdue|delinquent/i.test(text)) {
      fields.push({
        fieldKey: "pastDueStatus",
        value: true,
        confidence: "low",
        source: "local_text_extraction",
        evidence: "past due",
      });
    }

    return {
      ok: fields.length > 0,
      provider: "local_text",
      fields,
      warnings: [
        "Review all bill-derived fields before checking eligibility or generating a PDF.",
        "This local fallback only extracts obvious text. LLM/OCR extraction can be added behind the same interface.",
      ],
    };
  }
}
