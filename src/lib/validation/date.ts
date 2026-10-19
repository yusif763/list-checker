import type { ValidationIssue } from "@/lib/types";
import type { FieldValidation } from "./fin";

/** Tələb olunan format: GG.AA.İİİİ (məs. 15.08.1990). */

function isValidCalendarDate(day: number, month: number, year: number): boolean {
  if (month < 1 || month > 12) return false;
  if (year < 1900 || year > 2100) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  return day >= 1 && day <= daysInMonth;
}

function format(day: number, month: number, year: number): string {
  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  return `${dd}.${mm}.${year}`;
}

/**
 * Excel serial tarixini (1900 sistemi) GG.AA.İİİİ formatına çevirir.
 * SheetJS bəzən tarixləri rəqəm kimi oxuyur.
 */
export function excelSerialToDate(serial: number): { day: number; month: number; year: number } | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  // Excel 1900 leap-year səhvinə görə düzəliş.
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400 * 1000;
  const d = new Date(utcValue);
  if (Number.isNaN(d.getTime())) return null;
  return { day: d.getUTCDate(), month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
}

/**
 * Doğum tarixini normallaşdırır. Qeyri-müəyyən tarixləri (məs. 03/04/2000)
 * konvensiya olmadan təxmin etmir — səhv kimi işarələyir.
 */
export function normalizeDate(raw: string | null | undefined): FieldValidation {
  const issues: ValidationIssue[] = [];
  const original = raw ?? "";
  const trimmed = original.trim();

  if (!trimmed) {
    return {
      normalized: null,
      issues: [
        {
          field: "dateOfBirth",
          code: "date.empty",
          message: "Doğum tarixi boşdur.",
          severity: "warning",
          originalValue: original || null,
          suggestion: null,
        },
      ],
    };
  }

  // Excel serial rəqəmi?
  if (/^\d{4,6}(\.\d+)?$/.test(trimmed)) {
    const serial = Number(trimmed);
    const parts = excelSerialToDate(serial);
    if (parts && isValidCalendarDate(parts.day, parts.month, parts.year)) {
      const formatted = format(parts.day, parts.month, parts.year);
      issues.push({
        field: "dateOfBirth",
        code: "date.from-serial",
        message: "Excel tarix dəyəri GG.AA.İİİİ formatına çevrildi.",
        severity: "info",
        originalValue: original,
        suggestion: formatted,
      });
      return { normalized: formatted, issues };
    }
  }

  // Ayırıcıları normallaşdır: . / - və boşluq.
  const parts = trimmed.split(/[.\/\-\s]+/).filter(Boolean);
  if (parts.length !== 3 || !parts.every((p) => /^\d+$/.test(p))) {
    issues.push({
      field: "dateOfBirth",
      code: "date.invalid-format",
      message: "Tarix formatı tanınmır. Tələb olunan format: GG.AA.İİİİ.",
      severity: "error",
      originalValue: original,
      suggestion: null,
    });
    return { normalized: null, issues };
  }

  const [p1, p2, p3] = parts.map(Number);
  let day: number, month: number, year: number;
  const yearIsFirst = parts[0].length === 4;

  // Format aşkarlanması: ilk hissə 4 rəqəmdirsə İİİİ.AA.GG.
  if (yearIsFirst) {
    year = p1;
    month = p2;
    day = p3;
  } else {
    day = p1;
    month = p2;
    year = p3;
  }

  // 2 rəqəmli il — qeyri-müəyyən, təxmin etmirik.
  const yearPart = yearIsFirst ? parts[0] : parts[2];
  if (yearPart.length === 2) {
    issues.push({
      field: "dateOfBirth",
      code: "date.ambiguous-year",
      message: "İl 2 rəqəmlidir və qeyri-müəyyəndir. 4 rəqəmli il tələb olunur.",
      severity: "error",
      originalValue: original,
      suggestion: null,
    });
    return { normalized: null, issues };
  }

  // Gün və ay hər ikisi <= 12 olduqda qeyri-müəyyən (GG/AA, yoxsa AA/GG?).
  if (!yearIsFirst && day <= 12 && month <= 12 && day !== month) {
    issues.push({
      field: "dateOfBirth",
      code: "date.ambiguous",
      message: `Tarix qeyri-müəyyəndir (${original}) — gün/ay sırası təxmin edilmir. GG.AA.İİİİ formatında daxil edin.`,
      severity: "warning",
      originalValue: original,
      suggestion: null,
    });
  }

  if (!isValidCalendarDate(day, month, year)) {
    issues.push({
      field: "dateOfBirth",
      code: "date.impossible",
      message: `Mümkün olmayan tarix: ${original}.`,
      severity: "error",
      originalValue: original,
      suggestion: null,
    });
    return { normalized: null, issues };
  }

  const formatted = format(day, month, year);
  if (formatted !== trimmed) {
    issues.push({
      field: "dateOfBirth",
      code: "date.normalizable",
      message: "Tarix GG.AA.İİİİ formatına gətirilə bilər.",
      severity: "info",
      originalValue: original,
      suggestion: formatted,
    });
  }

  return { normalized: formatted, issues };
}
