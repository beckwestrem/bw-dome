import type { DataSourceAdapter, NormalizedIngestion } from "@/lib/sources";
import { ingestCsvRows, parseCsv } from "@/lib/csv-schemas";
import type { CsvValidationIssue } from "@/lib/csv-schemas";

type CsvInput = {
  fileName: string;
  csvText: string;
  /** Use when CSV has no account column (e.g. single bank account export). */
  defaultAccountName?: string;
};

export type CsvIngestResult =
  | { ok: true; data: NormalizedIngestion }
  | { ok: false; issues: CsvValidationIssue[] }
  | { ok: false; error: string };

export class CsvUploadAdapter implements DataSourceAdapter<CsvInput> {
  sourceType = "csv_upload" as const;

  async ingest(input: CsvInput): Promise<NormalizedIngestion> {
    const result = CsvUploadAdapter.parse(input);
    if (!result.ok) {
      if ("error" in result && result.error) {
        throw new Error(result.error);
      }
      if ("issues" in result) {
        throw new Error(
          result.issues.map((i) => `Row ${i.row}: ${i.message}`).join("\n"),
        );
      }
      throw new Error("CSV ingest failed");
    }
    return result.data;
  }

  static parse(input: CsvInput): CsvIngestResult {
    const parsed = parseCsv(input.csvText);
    if (!parsed) {
      return {
        ok: false,
        error: "CSV must include a header row and at least one data row.",
      };
    }
    const out = ingestCsvRows(input.fileName, parsed.rows, parsed.headerMap, {
      defaultAccountName: input.defaultAccountName,
    });
    if (!out.ok) {
      return { ok: false, issues: out.issues };
    }
    return { ok: true, data: out.data };
  }
}
