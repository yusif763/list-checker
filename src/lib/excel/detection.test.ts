import { describe, it, expect } from "vitest";
import { detectField, detectFields } from "./field-detection";

describe("sütun sahə aşkarlanması", () => {
  it("Azərbaycan başlıqlarını tanıyır", () => {
    expect(detectField("Ad").field).toBe("firstName");
    expect(detectField("Soyadı").field).toBe("lastName");
    expect(detectField("Ata adı").field).toBe("patronymic");
    expect(detectField("FİN").field).toBe("finCode");
    expect(detectField("Doğum tarixi").field).toBe("dateOfBirth");
    expect(detectField("Mobil nömrə").field).toBe("phone");
    expect(detectField("E-poçt").field).toBe("email");
    expect(detectField("Cins").field).toBe("gender");
  });

  it("ingilis başlıqlarını tanıyır", () => {
    expect(detectField("First Name").field).toBe("firstName");
    expect(detectField("Surname").field).toBe("lastName");
    expect(detectField("FIN Code").field).toBe("finCode");
  });

  it("birləşmiş tam ad sütununu tanıyır", () => {
    expect(detectField("Soyadı, adı, atasının adı").field).toBe("fullName");
  });

  it("eyni sahəyə iki sütun düşərsə yalnız ən inamlını saxlayır", () => {
    const guesses = detectFields(["Ad", "Adı"]);
    const firstNameCount = guesses.filter((g) => g.field === "firstName").length;
    expect(firstNameCount).toBe(1);
  });

  it("naməlum başlığı null qaytarır", () => {
    expect(detectField("Qeyd 123 xxx").field).toBeNull();
  });
});
