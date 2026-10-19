import { describe, it, expect } from "vitest";
import type { CanonicalField, PersonRecord } from "@/lib/types";
import { matchRecord } from "./engine";
import { detectDuplicates } from "./duplicates";
import { levenshtein, jaroWinkler, nameSimilarity, patronymicSimilarity } from "./string-similarity";
import { compareFields } from "./engine";

function rec(id: string, fields: Partial<Record<CanonicalField, string>>): PersonRecord {
  return {
    id,
    sourceFile: "test.xlsx",
    sheetName: "Sheet1",
    rowNumber: 1,
    raw: fields,
    normalized: fields,
  };
}

describe("string oxşarlığı", () => {
  it("levenshtein", () => {
    expect(levenshtein("abc", "abc")).toBe(0);
    expect(levenshtein("abc", "abd")).toBe(1);
  });
  it("jaroWinkler oxşar adlar üçün yüksəkdir", () => {
    expect(jaroWinkler("memmedov", "memmedov")).toBe(1);
    expect(nameSimilarity("Məmmədov", "Memmedov")).toBeGreaterThan(0.95);
  });
  it("patronim oğlu/qızı suffiksini nəzərə almır", () => {
    expect(patronymicSimilarity("Əlibala", "Əlibala oğlu")).toBeGreaterThanOrEqual(0.97);
    expect(patronymicSimilarity("Vəli qızı", "Vəli")).toBeGreaterThanOrEqual(0.97);
  });
});

describe("sahə müqayisəsi — patronim suffiksi", () => {
  it("'Əlibala' və 'Əlibala Oğlu' uyğun sayılır", () => {
    const a = rec("a", { patronymic: "Əlibala" });
    const b = rec("b", { patronymic: "Əlibala Oğlu" });
    const comp = compareFields(a, b).find((c) => c.field === "patronymic");
    expect(comp?.status).toBe("match");
  });
});

describe("uyğunlaşdırma mühərriki (Yekun -> İstinad)", () => {
  const references = [
    rec("m1", { firstName: "Əli", lastName: "Məmmədov", finCode: "ABC1234", dateOfBirth: "15.08.1990" }),
    rec("m2", { firstName: "Aysel", lastName: "Həsənova", finCode: "DEF9876", dateOfBirth: "01.01.1995" }),
  ];

  it("FİN dəqiq uyğunluğunu tapır", () => {
    const final = rec("f1", { firstName: "Əli", lastName: "Məmmədov", finCode: "ABC1234", dateOfBirth: "15.08.1990" });
    const r = matchRecord(final, references);
    expect(r.status).toBe("found");
    expect(r.method).toBe("fin");
    expect(r.matchedRecordId).toBe("m1");
  });

  it("FİN uyğun, tarix fərqli -> uyğunsuzluq", () => {
    const final = rec("f2", { firstName: "Əli", lastName: "Məmmədov", finCode: "ABC1234", dateOfBirth: "16.08.1990" });
    const r = matchRecord(final, references);
    expect(r.status).toBe("found_mismatch");
    expect(r.comparisons.find((c) => c.field === "dateOfBirth")?.status).toBe("mismatch");
  });

  it("uyğun olmayan qeyd -> tapılmadı", () => {
    const final = rec("f3", { firstName: "Nigar", lastName: "Quliyeva", finCode: "ZZZ0000" });
    const r = matchRecord(final, references);
    expect(r.status).toBe("not_found");
  });

  it("yalnız ad/soyad eyni olduqda dəqiq uyğunluq sayılmır", () => {
    const refs = [rec("x", { firstName: "Əli", lastName: "Məmmədov" })];
    const final = rec("y", { firstName: "Əli", lastName: "Məmmədov" });
    const r = matchRecord(final, refs);
    expect(r.status).not.toBe("found");
    expect(["possible", "not_found"]).toContain(r.status);
  });
});

describe("təkrar aşkarlanması", () => {
  it("eyni FİN, eyni ad -> eyni şəxs təkrarı", () => {
    const records = [
      rec("a", { firstName: "Əli", lastName: "Məmmədov", finCode: "ABC1234" }),
      rec("b", { firstName: "Əli", lastName: "Məmmədov", finCode: "ABC1234" }),
    ];
    const groups = detectDuplicates(records);
    expect(groups.some((g) => g.type === "same_fin_same_person")).toBe(true);
  });

  it("eyni FİN, fərqli ad -> ziddiyyət", () => {
    const records = [
      rec("a", { firstName: "Əli", lastName: "Məmmədov", finCode: "ABC1234" }),
      rec("b", { firstName: "Vəli", lastName: "Əliyev", finCode: "ABC1234" }),
    ];
    const groups = detectDuplicates(records);
    expect(groups.some((g) => g.type === "same_fin_diff_name")).toBe(true);
  });

  it("eyni ad, fərqli FİN", () => {
    const records = [
      rec("a", { firstName: "Əli", lastName: "Məmmədov", finCode: "ABC1234" }),
      rec("b", { firstName: "Əli", lastName: "Məmmədov", finCode: "XYZ5678" }),
    ];
    const groups = detectDuplicates(records);
    expect(groups.some((g) => g.type === "same_name_diff_fin")).toBe(true);
  });
});
