import { readFile } from "node:fs/promises";
import path from "node:path";

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

import type { LadwpEzSaveApplicationDraft, LadwpEzSaveDraftField } from "./types";

export type PdfFillResult =
  | { ok: true; fileName: string; bytes: Uint8Array }
  | { ok: false; reason: string };

export interface EzSavePdfService {
  fillApplicationPdf(draft: LadwpEzSaveApplicationDraft): Promise<PdfFillResult>;
}

type DraftFieldMap = Map<string, LadwpEzSaveDraftField["value"]>;

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "public/forms/ladwp-ez-save-application.pdf",
);

const TEXT_COLOR = rgb(0.02, 0.14, 0.85);
const BOX_FONT_SIZE = 9;

function fieldMap(draft: LadwpEzSaveApplicationDraft): DraftFieldMap {
  return new Map(draft.fields.map((field) => [field.fieldKey, field.value]));
}

function textValue(fields: DraftFieldMap, key: string): string {
  const value = fields.get(key);
  if (value === undefined || value === null || typeof value === "boolean") return "";
  return String(value).trim();
}

function moneyValue(fields: DraftFieldMap, key: string): string {
  const value = fields.get(key);
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return Math.round(value).toLocaleString("en-US");
}

function numberValue(fields: DraftFieldMap, key: string): string {
  const value = fields.get(key);
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return String(value);
}

function topLeftY(pageHeight: number, top: number, offset = 9) {
  return pageHeight - top - offset;
}

function boxedText(value: string, maxChars: number, digitsOnly = false) {
  const normalized = digitsOnly ? value.replace(/\D/g, "") : value.toUpperCase();
  return normalized.slice(0, maxChars);
}

export class PdfLibEzSavePdfService implements EzSavePdfService {
  async fillApplicationPdf(draft: LadwpEzSaveApplicationDraft): Promise<PdfFillResult> {
    try {
      const templateBytes = await readFile(TEMPLATE_PATH);
      const pdfDoc = await PDFDocument.load(templateBytes);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const page = pdfDoc.getPage(0);
      const { height } = page.getSize();
      const fields = fieldMap(draft);

      const drawBoxed = (
        value: string,
        x: number,
        top: number,
        maxChars: number,
        cellWidth = 17,
        digitsOnly = false,
      ) => {
        const text = boxedText(value, maxChars, digitsOnly);
        for (const [index, character] of [...text].entries()) {
          page.drawText(character, {
            x: x + index * cellWidth + 3,
            y: topLeftY(height, top, 8),
            size: BOX_FONT_SIZE,
            font,
            color: TEXT_COLOR,
          });
        }
      };

      const mark = (selected: boolean, x: number, top: number) => {
        if (!selected) return;
        page.drawText("X", {
          x,
          y: topLeftY(height, top, 8),
          size: 10,
          font,
          color: TEXT_COLOR,
        });
      };

      drawBoxed(textValue(fields, "account_number"), 166, 294, 10, 17, true);
      mark(fields.get("new_application_or_renewal") !== "renewal", 461, 293);
      mark(fields.get("new_application_or_renewal") === "renewal", 563, 293);
      drawBoxed(textValue(fields, "last_name"), 132, 335, 20);
      drawBoxed(textValue(fields, "middle_initial"), 489, 335, 1);
      drawBoxed(textValue(fields, "first_name"), 132, 373, 10);
      drawBoxed(textValue(fields, "service_address_street_number"), 81, 413, 6);
      drawBoxed(textValue(fields, "service_address_street_name"), 200, 413, 22);
      drawBoxed(textValue(fields, "apartment_number"), 81, 446, 5);
      drawBoxed(textValue(fields, "phone"), 132, 481, 10, 17, true);
      drawBoxed(textValue(fields, "mobile_phone"), 404, 481, 10, 17, true);
      drawBoxed(numberValue(fields, "household_total"), 268, 533, 2, 17, true);
      drawBoxed(numberValue(fields, "household_adults"), 370, 533, 2, 17, true);
      drawBoxed(numberValue(fields, "household_children"), 455, 533, 2, 17, true);
      drawBoxed(moneyValue(fields, "annual_gross_household_income"), 268, 561, 6, 17, true);

      return {
        ok: true,
        fileName: "ladwp-ez-save-application-draft.pdf",
        bytes: await pdfDoc.save(),
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown PDF error";
      return {
        ok: false,
        reason: `Could not generate the LADWP EZ-SAVE PDF. ${detail}`,
      };
    }
  }
}
