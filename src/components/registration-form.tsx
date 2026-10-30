"use client";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowUpRight,
  CheckCircle2,
  Copy,
  LoaderCircle,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { registrationSchema, type RegistrationInput } from "@/lib/validation";
import type { Category, EventConfig, Position } from "@/lib/domain";
import { money } from "@/lib/utils";
import { Button } from "./ui/button";
interface Receipt {
  id: string;
  amount: number;
  alias: string;
  holder: string;
  bank_account: string;
  payment_instructions: string;
}
export function RegistrationForm({
  categories,
  positions,
  event,
  connected,
  admin = false,
  onDone,
  initial,
  submitLabel,
}: {
  categories: Category[];
  positions: Position[];
  event: EventConfig;
  connected: boolean;
  admin?: boolean;
  onDone?: (input: RegistrationInput) => Promise<void>;
  initial?: Partial<RegistrationInput>;
  submitLabel?: string;
}) {
  const [receipt, setReceipt] = useState<Receipt | null>(null),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationInput>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      phone: "",
      category_id: "",
      position_id: "",
      consent: false,
      public_consent: false,
      guardian_consent: false,
      website: "",
      ...initial,
    },
  });
  const age = useWatch({ control, name: "age" }),
    values = getValues();
  async function submit(input: RegistrationInput) {
    setError("");
    try {
      if (onDone) {
        await onDone(input);
        return;
      }
      const response = await fetch("/api/inscripcion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setReceipt(result.data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo enviar la inscripción.",
      );
    }
  }
  const fieldError = (name: keyof RegistrationInput) =>
    errors[name] && (
      <span className="field-error" role="alert">
        {errors[name]?.message}
      </span>
    );
  if (receipt) {
    const message = encodeURIComponent(
      `Hola, soy ${values.first_name} ${values.last_name}. Me inscribí al Seven Interno Antonio “Tony” Leyes en la categoría ${categories.find((c) => c.id === values.category_id)?.name}. Te envío mi comprobante de pago.`,
    );
    return (
      <div className="receipt" role="status">
        <CheckCircle2 size={48} />
        <p className="eyebrow">INSCRIPCIÓN RECIBIDA</p>
        <h2>¡Ya diste el primer paso!</h2>
        <p>
          Transferí el importe al alias indicado y enviá el comprobante por
          WhatsApp a uno de los organizadores. La participación queda pendiente
          hasta la confirmación.
        </p>
        <div className="payment-details">
          <span>IMPORTE A TRANSFERIR</span>
          <strong>{money(receipt.amount)}</strong>
          <label>Alias</label>
          <div className="copy-alias">
            <b>{receipt.alias || "La organización debe informar el alias"}</b>
            {receipt.alias && (
              <button
                aria-label="Copiar alias"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(receipt.alias);
                    setCopied(true);
                  } catch {
                    setError("Copiá el alias manualmente.");
                  }
                }}
              >
                {copied ? "Copiado" : <Copy size={19} />}
              </button>
            )}
          </div>
          <p>Titular: {receipt.holder || "A confirmar"}</p>
          {receipt.bank_account && <p>CBU/CVU: {receipt.bank_account}</p>}
        </div>
        <p>{receipt.payment_instructions}</p>
        <div className="whatsapp-buttons">
          <a
            href={`https://wa.me/5491127056803?text=${message}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
          >
            <MessageCircle size={20} /> Enviar a Fede <ArrowUpRight size={17} />
          </a>
          <a
            href={`https://wa.me/5491131202929?text=${message}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline dark-outline"
          >
            <MessageCircle size={20} /> Enviar a Bauti{" "}
            <ArrowUpRight size={17} />
          </a>
        </div>
        <small>
          Adjuntá el comprobante manualmente en WhatsApp. Abrir el chat no
          confirma el pago.
        </small>
        {error && <p className="form-alert error">{error}</p>}
      </div>
    );
  }
  const closed = !admin && (!connected || !event.registration_open);
  return (
    <form
      className="registration-form"
      onSubmit={handleSubmit(submit)}
      noValidate
    >
      <div className="form-heading">
        <span className="step-indicator">01 / TUS DATOS</span>
        <span>Campos con * obligatorios</span>
      </div>
      {closed && (
        <p className="form-alert" role="status">
          {connected
            ? "Las inscripciones todavía no están abiertas. Podés consultar a los organizadores."
            : "La inscripción estará disponible cuando la organización active la plataforma."}
        </p>
      )}
      <div className="form-grid">
        <label>
          Nombre *
          <input
            autoComplete="given-name"
            {...register("first_name")}
            aria-invalid={!!errors.first_name}
            placeholder="Tu nombre"
          />
          {fieldError("first_name")}
        </label>
        <label>
          Apellido *
          <input
            autoComplete="family-name"
            {...register("last_name")}
            aria-invalid={!!errors.last_name}
            placeholder="Tu apellido"
          />
          {fieldError("last_name")}
        </label>
        <label>
          Edad *
          <input
            type="number"
            inputMode="numeric"
            min={13}
            max={90}
            step={1}
            {...register("age", { valueAsNumber: true })}
            aria-invalid={!!errors.age}
            placeholder="Tu edad en años"
          />
          {fieldError("age")}
        </label>
        <label>
          Categoría *
          <select
            {...register("category_id")}
            aria-invalid={!!errors.category_id}
          >
            <option value="">Seleccioná tu categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {fieldError("category_id")}
        </label>
        <label>
          Posición principal *
          <select
            {...register("position_id")}
            aria-invalid={!!errors.position_id}
          >
            <option value="">¿Dónde jugás?</option>
            {(["forward", "back"] as const).map((g) => (
              <optgroup key={g} label={g === "forward" ? "Forwards" : "Backs"}>
                {positions
                  .filter((p) => p.group === g)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          {fieldError("position_id")}
        </label>
        <label>
          Teléfono de contacto *
          <input
            type="tel"
            autoComplete="tel"
            {...register("phone")}
            aria-invalid={!!errors.phone}
            placeholder="11 1234 5678"
          />
          {fieldError("phone")}
        </label>
      </div>
      {age < 18 && age >= 13 && (
        <fieldset className="guardian-fields">
          <legend>Autorización de responsable</legend>
          <p>
            Para participar siendo menor de 18 años, se requiere la autorización
            de tu madre, padre o tutor.
          </p>
          <div className="form-grid">
            <label>
              Nombre del responsable *
              <input autoComplete="off" {...register("guardian_name")} />
              {fieldError("guardian_name")}
            </label>
            <label>
              Teléfono del responsable *
              <input type="tel" {...register("guardian_phone")} />
              {fieldError("guardian_phone")}
            </label>
          </div>
          <label className="check-label">
            <input type="checkbox" {...register("guardian_consent")} />
            <span>
              El responsable indicado autoriza la participación y el tratamiento
              de los datos para organizar el torneo. *
            </span>
          </label>
          {fieldError("guardian_consent")}
        </fieldset>
      )}
      <div className="honeypot" aria-hidden="true">
        <label>
          Sitio web
          <input tabIndex={-1} autoComplete="off" {...register("website")} />
        </label>
      </div>
      <div className="form-consents">
        <label className="check-label">
          <input type="checkbox" {...register("consent")} />
          <span>
            Acepto las{" "}
            <a href="/privacidad" target="_blank">
              condiciones de participación y el tratamiento de mis datos
            </a>{" "}
            para organizar el Seven. *
          </span>
        </label>
        {fieldError("consent")}
        <label className="check-label">
          <input type="checkbox" {...register("public_consent")} />
          <span>
            Si soy mayor de edad, autorizo mostrar mi nombre y la inicial de mi
            apellido en el plantel público. Opcional.
          </span>
        </label>
      </div>
      {error && (
        <p className="form-alert error" role="alert">
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={closed || isSubmitting}
        className="submit-button"
      >
        {isSubmitting ? (
          <>
            <LoaderCircle className="spin" size={20} /> Enviando inscripción…
          </>
        ) : (
          <>
            {" "}
            {submitLabel ??
              (admin ? "Agregar jugador" : "Inscribirme al Seven")}{" "}
            <ArrowUpRight size={21} />
          </>
        )}
      </Button>
      <p className="secure-note">
        <ShieldCheck size={15} /> Tus datos personales solo son visibles para la
        organización.
      </p>
    </form>
  );
}
