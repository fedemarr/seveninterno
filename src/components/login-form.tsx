"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { ArrowRight, LoaderCircle } from "lucide-react";
export function LoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const form = new FormData(e.currentTarget);
        try {
          const r = await fetch("/api/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: form.get("email"),
              password: form.get("password"),
            }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          router.push("/admin");
          router.refresh();
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "No se pudo iniciar sesión.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Email
        <input
          type="email"
          name="email"
          autoComplete="username"
          placeholder="tu@email.com"
          required
        />
      </label>
      <label>
        Contraseña
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          minLength={8}
          required
        />
      </label>
      {!configured && (
        <p className="form-alert">
          Falta conectar Supabase. Consultá el README del proyecto para activar
          las cuentas de organización.
        </p>
      )}
      {error && (
        <p className="form-alert error" role="alert">
          {error}
        </p>
      )}
      <Button disabled={!configured || busy} className="submit-button">
        {busy ? (
          <LoaderCircle className="spin" size={20} />
        ) : (
          <>
            Ingresar al panel <ArrowRight size={20} />
          </>
        )}
      </Button>
    </form>
  );
}
