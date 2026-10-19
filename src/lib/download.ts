import { buildReportWorkbook, type CorrectionsMap } from "@/lib/excel/export";
import type { VerificationOutput } from "@/lib/verification";

/** Yoxlama nəticəsindən Excel hesabatı yaradır və brauzerdə yükləyir. */
export function downloadReport(verification: VerificationOutput, corrections: CorrectionsMap) {
  const buffer = buildReportWorkbook(verification.rows, verification.duplicates, corrections);
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `yoxlama-hesabati-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
