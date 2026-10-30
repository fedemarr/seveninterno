"use client";
import { useState } from "react";
import type { AdminSnapshot } from "@/lib/data";
import type { AdminCommand } from "@/lib/commands";
import { RegistrationForm } from "./registration-form";
type OnsiteData = Extract<
  AdminCommand,
  { type: "player.onsite.create" }
>["data"];
export function OnsitePlayerForm({
  data,
  competitionId,
  initialTeamId,
  onSubmit,
}: {
  data: AdminSnapshot;
  competitionId: string;
  initialTeamId: string;
  onSubmit: (input: OnsiteData) => Promise<void>;
}) {
  const [paid, setPaid] = useState(false),
    [level, setLevel] = useState<"A" | "B" | "C" | "">(""),
    [teamId, setTeamId] = useState(initialTeamId);
  return (
    <RegistrationForm
      categories={data.categories}
      positions={data.positions}
      event={data.event}
      connected
      admin
      submitLabel={
        paid ? "Guardar e incorporar jugador" : "Guardar inscripción pendiente"
      }
      extraFields={
        <fieldset className="onsite-fields">
          <legend>Alta el día del Seven</legend>
          <label className="check-label">
            <input
              type="checkbox"
              checked={paid}
              onChange={(e) => setPaid(e.target.checked)}
            />
            Confirmo que la organización recibió el pago
          </label>
          <div className="form-grid">
            <label>
              Nivel deportivo
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as typeof level)}
              >
                <option value="">Sin evaluar · B provisional</option>
                <option value="A">A · Alto</option>
                <option value="B">B · Intermedio</option>
                <option value="C">C · Inicial</option>
              </select>
            </label>
            <label>
              Equipo de destino
              <select
                value={teamId}
                disabled={!paid}
                onChange={(e) => setTeamId(e.target.value)}
              >
                <option value="">Asignar automáticamente</option>
                {data.teams
                  .filter((t) => t.competition_id === competitionId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <p>
            {paid
              ? "Si elegís un equipo, la asignación queda fijada. Si elegís automático, se busca una distribución equilibrada."
              : "Si todavía no pagó, queda pendiente y se incorpora al confirmar el pago."}
          </p>
        </fieldset>
      }
      onDone={(input) =>
        onSubmit({
          input,
          competition_id: competitionId,
          payment_confirmed: paid,
          level,
          team_id: paid ? teamId : "",
        })
      }
    />
  );
}
