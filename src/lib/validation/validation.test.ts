import { describe, it, expect } from "vitest";
import { normalizeFin } from "./fin";
import { normalizePhone } from "./phone";
import { normalizeDate } from "./date";
import { validateEmail } from "./email";
import { normalizeName } from "./name";
import { normalizeGender, toGender } from "./gender";
import { parseFullName } from "./name-parsing";

describe("FİN normalizasiyası", () => {
  it("kiçik hərfləri böyüdür və boşluqları silir", () => {
    const r = normalizeFin(" abc1234 ");
    expect(r.normalized).toBe("ABC1234");
  });
  it("yanlış uzunluğu səhv kimi işarələyir", () => {
    const r = normalizeFin("ABC12");
    expect(r.issues.some((i) => i.code === "fin.invalid-length")).toBe(true);
  });
  it("boş dəyəri səhv kimi işarələyir", () => {
    expect(normalizeFin("").issues[0].code).toBe("fin.empty");
  });
});

describe("Telefon normalizasiyası", () => {
  it("0503006677 -> (050) 300 66 77", () => {
    expect(normalizePhone("0503006677").normalized).toBe("(050) 300 66 77");
  });
  it("+994 prefiksini emal edir", () => {
    expect(normalizePhone("+994503006677").normalized).toBe("(050) 300 66 77");
  });
  it("tanınmayan prefiksi rədd edir", () => {
    const r = normalizePhone("0123006677");
    expect(r.normalized).toBeNull();
    expect(r.issues.some((i) => i.code === "phone.invalid-prefix")).toBe(true);
  });
  it("natamam nömrəni rədd edir", () => {
    expect(normalizePhone("05030066").normalized).toBeNull();
  });
});

describe("Tarix normalizasiyası", () => {
  it("GG.AA.İİİİ formatını qəbul edir", () => {
    expect(normalizeDate("15.08.1990").normalized).toBe("15.08.1990");
  });
  it("mümkün olmayan tarixi rədd edir", () => {
    const r = normalizeDate("32.01.1990");
    expect(r.normalized).toBeNull();
    expect(r.issues.some((i) => i.code === "date.impossible")).toBe(true);
  });
  it("2 rəqəmli ili qeyri-müəyyən sayır", () => {
    expect(normalizeDate("15.08.90").normalized).toBeNull();
  });
  it("Excel serial dəyərini çevirir", () => {
    // 33100 = 15.08.1990
    expect(normalizeDate("33100").normalized).toBe("15.08.1990");
  });
});

describe("E-poçt yoxlaması", () => {
  it("düzgün sintaksisi qəbul edir", () => {
    expect(validateEmail("Test@Mail.com").normalized).toBe("test@mail.com");
  });
  it("@ olmadan rədd edir", () => {
    expect(validateEmail("testmail.com").normalized).toBeNull();
  });
  it("çoxlu @ rədd edir", () => {
    expect(validateEmail("a@@b.com").issues.some((i) => i.code === "email.multiple-at")).toBe(true);
  });
});

describe("Ad normalizasiyası", () => {
  it("baş hərfləri böyüdür və boşluğu azaldır", () => {
    expect(normalizeName("  əli  ").normalized).toBe("Əli");
  });
  it("rəqəmləri xəbərdarlıq kimi işarələyir", () => {
    expect(normalizeName("Əli2").issues.some((i) => i.code === "name.has-digits")).toBe(true);
  });
  it("Azərbaycan hərflərini qoruyur", () => {
    expect(normalizeName("şəf  qəni").normalized).toBe("Şəf Qəni");
  });
});

describe("Cins normalizasiyası", () => {
  it("müxtəlif formaları tanıyır", () => {
    expect(toGender("kişi")).toBe("MALE");
    expect(toGender("Qadın")).toBe("FEMALE");
    expect(toGender("M")).toBe("MALE");
    expect(toGender("female")).toBe("FEMALE");
  });
  it("tanınmayanı işarələyir", () => {
    expect(normalizeGender("xyz").normalized).toBeNull();
  });
});

describe("Tam ad ayrılması", () => {
  it("oğlu suffiksi ilə düzgün ayırır", () => {
    const r = parseFullName("Məmmədov Əli Hüseyn oğlu");
    expect(r.lastName).toBe("Məmmədov");
    expect(r.firstName).toBe("Əli");
    expect(r.patronymic).toBe("Hüseyn oğlu");
    expect(r.requiresReview).toBe(false);
  });
  it("suffikssiz 3 sözü yoxlamaya göndərir", () => {
    const r = parseFullName("Məmmədov Əli Hüseyn");
    expect(r.requiresReview).toBe(true);
  });
  it("qızı suffiksini tanıyır", () => {
    const r = parseFullName("Əliyeva Aysel Vəli qızı");
    expect(r.patronymic).toBe("Vəli qızı");
    expect(r.firstName).toBe("Aysel");
  });
});
