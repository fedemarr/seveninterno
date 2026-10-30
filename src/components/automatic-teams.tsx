"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, Users, Settings2 } from "lucide-react";
import type { AdminSnapshot } from "@/lib/data";
import type { AdminCommand } from "@/lib/commands";
import { Button } from "./ui/button";

export function AutomaticTeams({
  data,
  competitionId,
  busy,
  onConfigure,
}: {
  data: AdminSnapshot;
  competitionId: string;
  busy: boolean;
  onConfigure: (command: AdminCommand) => void;
}) {
  const competition = data.competitions.find((c) => c.id === competitionId);
  const [size, setSize] = useState(competition?.auto_team_size ?? 10),
    [capacity, setCapacity] = useState(competition?.auto_team_capacity ?? 15);
  if (!competition) return null;
  const teams = data.teams
    .filter((t) => t.competition_id === competition.id)
    .sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }));
  const confirmed = data.registrations.filter(
    (r) =>
      r.active &&
      r.payment_status === "PAGO_CONFIRMADO" &&
      competition.category_ids.includes(r.category_id),
  );
  const frozen =
    teams.some((t) => t.published) ||
    data.matches.some((m) => m.competition_id === competition.id);
  const configure = (enabled: boolean) =>
    onConfigure({
      type: "teams.automatic",
      data: {
        competition_id: competition.id,
        enabled,
        team_size: size,
        capacity,
      },
    });
  return (
    <div className="automatic-teams">
      <section className="admin-card">
        <div className="automatic-heading">
          <div>
            <h2>Confirmás jugadores. Los equipos se arman solos.</h2>
            <p>
              Todas las categorías mezcladas, equilibradas por A/B/C, edad y
              posición.
            </p>
          </div>
          <span
            className={`automatic-status ${competition.automatic_teams ? "enabled" : ""}`}
          >
            <Check size={15} />
            {competition.automatic_teams
              ? "Automático activo"
              : "Automático pausado"}
          </span>
        </div>
        {(!competition.automatic_teams ||
          (!teams.length && confirmed.length > 0)) && (
          <Button
            disabled={busy || data.role === "scorer"}
            onClick={() => configure(true)}
          >
            {competition.automatic_teams
              ? "Armar equipos con los confirmados"
              : "Activar equipos automáticos"}
          </Button>
        )}
        <div className="automatic-summary">
          <span>
            <Users size={17} />
            {confirmed.length} confirmados · {teams.length} equipos
          </span>
          <span>
            {
              data.registrations.filter(
                (p) => p.active && p.payment_status !== "PAGO_CONFIRMADO",
              ).length
            }{" "}
            pendientes de pago
          </span>
        </div>
        <p className="muted">
          {frozen
            ? "El fixture o los planteles ya están preparados: los nuevos confirmados se suman a equipos existentes. Se conservan los partidos."
            : "Mientras sean borradores, se reparten los confirmados y se crean nuevos equipos cuando alcanza la cantidad. No necesitás generar propuestas."}
        </p>
        <p className="muted">
          Los jugadores sin A/B/C usan nivel B provisional. Al evaluarlos, se
          actualiza el equilibrio de los borradores.
        </p>
        <details className="automatic-settings">
          <summary>
            <Settings2 size={15} /> Ajustes de equipos
          </summary>
          <div className="form-grid">
            <label>
              Jugadores previstos por equipo
              <input
                type="number"
                min={7}
                max={15}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
              />
            </label>
            <label>
              Máximo por equipo para altas posteriores
              <input
                type="number"
                min={size}
                max={25}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
              />
            </label>
          </div>
          <div className="automatic-actions">
            <Button
              disabled={busy || data.role === "scorer"}
              size="sm"
              onClick={() => configure(true)}
            >
              Guardar y actualizar equipos
            </Button>
            {competition.automatic_teams && (
              <Button
                disabled={busy || data.role === "scorer"}
                size="sm"
                variant="outline"
                onClick={() => configure(false)}
              >
                Pausar automático
              </Button>
            )}
          </div>
        </details>
      </section>
      <div className="teams-grid automatic-team-grid">
        {teams.map((team) => {
          const members = data.members.filter((m) => m.team_id === team.id);
          const players = members
            .map((m) =>
              data.registrations.find((r) => r.id === m.registration_id),
            )
            .filter((p) => p !== undefined);
          return (
            <section className="admin-card automatic-team-card" key={team.id}>
              <div className="automatic-team-title">
                <h2>{team.name}</h2>
                <span>{players.length} jugadores</span>
              </div>
              <small className="automatic-team-state">
                {team.published
                  ? "Publicado"
                  : players.length < 7
                    ? `En formación · faltan ${7 - players.length} para completar 7`
                    : "Borrador listo"}
              </small>
              <ul>
                {players.map((p) => (
                  <li key={p.id}>
                    <span>
                      {p.first_name} {p.last_name}
                    </span>
                    <b className={`level level-${p.level ?? "none"}`}>
                      {p.level ?? "B*"}
                    </b>
                  </li>
                ))}
              </ul>
              {!players.length && (
                <p className="muted">
                  Los próximos confirmados van a aparecer acá.
                </p>
              )}
            </section>
          );
        })}
      </div>
      {!teams.length && (
        <div className="admin-card admin-empty">
          <Users size={36} />
          <h3>Los equipos van a aparecer acá</h3>
          <p>Confirmá jugadores en Pagos para empezar a armarlos.</p>
          <Link href="/admin/pagos" className="btn btn-primary">
            Ir a confirmar jugadores
          </Link>
        </div>
      )}
      <div className="automatic-actions">
        <Link href="/admin/pagos" className="btn btn-primary">
          Confirmar más jugadores
        </Link>
        <Link href="/admin/evaluaciones" className="btn btn-outline">
          Asignar A / B / C
        </Link>
        {teams.length >= 4 && (
          <Link href="/admin/configuracion-torneo" className="btn btn-outline">
            Crear el torneo
          </Link>
        )}
        <Link href="/admin/equipos" className="btn btn-outline">
          Editar nombres y planteles
        </Link>
      </div>
      {teams.length > 0 && teams.length < 4 && (
        <p className="muted">
          Para el formato con grupos y copas hacen falta al menos 4 equipos
          completos. Se crearán al confirmar más jugadores.
        </p>
      )}
    </div>
  );
}
