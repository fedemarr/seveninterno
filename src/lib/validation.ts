import { z } from "zod";
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[\d\s()\-]{8,22}$/, "Ingresá un teléfono válido.");
export const registrationSchema = z
  .object({
    first_name: z.string().trim().min(2, "Ingresá tu nombre.").max(60),
    last_name: z.string().trim().min(2, "Ingresá tu apellido.").max(60),
    age: z
      .number()
      .int("La edad debe ser un número entero.")
      .min(13, "La edad mínima es 13 años.")
      .max(90),
    category_id: z.string().min(1, "Elegí una categoría."),
    position_id: z.string().min(1, "Elegí tu posición."),
    phone: phoneSchema,
    consent: z
      .boolean()
      .refine(Boolean, "Necesitamos tu aceptación para inscribirte."),
    public_consent: z.boolean(),
    guardian_name: z.string().trim().max(100).optional(),
    guardian_phone: z.string().trim().optional(),
    guardian_consent: z.boolean().optional(),
    website: z.string().max(0, "No se pudo enviar la inscripción."),
  })
  .superRefine((v, ctx) => {
    if (v.age < 18) {
      if (!v.guardian_name || v.guardian_name.length < 3)
        ctx.addIssue({
          code: "custom",
          path: ["guardian_name"],
          message: "Ingresá el nombre del responsable.",
        });
      if (!phoneSchema.safeParse(v.guardian_phone).success)
        ctx.addIssue({
          code: "custom",
          path: ["guardian_phone"],
          message: "Ingresá el teléfono del responsable.",
        });
      if (!v.guardian_consent)
        ctx.addIssue({
          code: "custom",
          path: ["guardian_consent"],
          message: "Se requiere autorización del responsable.",
        });
    }
  });
export type RegistrationInput = z.infer<typeof registrationSchema>;
export function checkCategory(
  age: number,
  category: { min_age: number; max_age: number },
) {
  return (
    Number.isInteger(age) && age >= category.min_age && age <= category.max_age
  );
}
export const normalizedPhone = (phone: string) =>
  phone.replace(/\D/g, "").replace(/^549/, "").replace(/^54/, "");
