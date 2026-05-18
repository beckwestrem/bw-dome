import type { LadwpEzSaveApplicationDraft } from "./types";

export type PdfFillResult =
  | { ok: true; fileName: string; bytes: Uint8Array }
  | { ok: false; reason: string };

export interface EzSavePdfService {
  fillApplicationPdf(draft: LadwpEzSaveApplicationDraft): Promise<PdfFillResult>;
}

export class StubEzSavePdfService implements EzSavePdfService {
  async fillApplicationPdf(): Promise<PdfFillResult> {
    return {
      ok: false,
      reason:
        "PDF filling is not implemented yet. Add a PDF form library and map the official LADWP EZ-SAVE PDF fields before enabling downloads.",
    };
  }
}
