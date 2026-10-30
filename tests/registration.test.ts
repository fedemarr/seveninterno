import { describe, it, expect } from "vitest";
import {
  checkCategory,
  registrationSchema,
  normalizedPhone,
} from "../src/lib/validation";
const input = {
  first_name: "Federico",
  last_name: "Prueba",
  age: 22,
  category_id: "adultos",
  position_id: "wing",
  phone: "11 2705-6803",
  consent: true,
  public_consent: false,
  website: "",
};
describe("Inscripción y elegibilidad", () => {
  it("valida adulto sin pedir fecha de nacimiento ni nivel", () =>
    expect(registrationSchema.parse(input)).toEqual(input));
  it.each([0, 12, 18.5, 91])("rechaza edad inválida %s", (age) =>
    expect(registrationSchema.safeParse({ ...input, age }).success).toBe(false),
  );
  it("requiere consentimiento", () =>
    expect(
      registrationSchema.safeParse({ ...input, consent: false }).success,
    ).toBe(false));
  it("requiere responsable y autorización para menor", () => {
    expect(registrationSchema.safeParse({ ...input, age: 16 }).success).toBe(
      false,
    );
    expect(
      registrationSchema.safeParse({
        ...input,
        age: 16,
        guardian_name: "Responsable Prueba",
        guardian_phone: "1122223333",
        guardian_consent: true,
      }).success,
    ).toBe(true);
  });
  it("bloquea spam por campo trampa", () =>
    expect(
      registrationSchema.safeParse({ ...input, website: "spam" }).success,
    ).toBe(false));
  it("verifica rango configurado de categoría", () => {
    expect(checkCategory(14, { min_age: 13, max_age: 14 })).toBe(true);
    expect(checkCategory(17, { min_age: 18, max_age: 90 })).toBe(false);
  });
  it("normaliza teléfonos para prevenir duplicados", () =>
    expect(normalizedPhone("+54 9 11 2705-6803")).toBe("1127056803"));
});
