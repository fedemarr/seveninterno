"use client";
import { useState } from "react";
import type { AdminSnapshot } from "@/lib/data";
import type { AdminCommand } from "@/lib/commands";
import { suggestLateTeam, type BalanceTeam } from "@/lib/engines/balance";
import { Button } from "./ui/button";
export function LateAssignment({
  data: d,
  competition,
  busy,
  onApply,
}: {
  data: AdminSnapshot;
  competition: string;
  busy: boolean;
  onApply: (command: AdminCommand) => void;
}) {
  const [playerId, setPlayerId] = useState(""),
    [capacity, setCapacity] = useState(10),
    [impact, setImpact] = useState(false);
  const player = d.registrations.find((r) => r.id === playerId),
    comp = d.competitions.find((c) => c.id === competition),
    teams = d.teams.filter((t) => t.competition_id === competition);
  const metrics: BalanceTeam[] = teams.map((t, index) => {
    const players = d.members
      .filter((m) => m.team_id === t.id)
      .map((m) => d.registrations.find((r) => r.id === m.registration_id)!);
    const forwards = players.filter(
      (p) =>
        d.positions.find((pos) => pos.id === p.position_id)?.group ===
        "forward",
    ).length;
    return {
      index,
      playerIds: players.map((p) => p.id),
      strength: players.reduce(
        (s, p) => s + (p.level === "A" ? 3 : p.level === "C" ? 1 : 2),
        0,
      ),
      forwards,
      backs: players.length - forwards,
    };
  });
  let suggestions: { teamIndex: number; cost: number }[] = [];
  let warning = "";
  if (player && comp) {
    try {
      const position = d.positions.find((p) => p.id === player.position_id)!;
      suggestions = suggestLateTeam(
        {
          id: player.id,
          level: player.level,
          position: position.name,
          group: position.group,
          paid: player.payment_status === "PAGO_CONFIRMADO",
          eligible:
            comp.category_ids.includes(player.category_id) &&
            player.age >= comp.min_age &&
            player.age <= comp.max_age,
          available: player.available && player.active,
          excluded: player.excluded,
          together: player.together_with,
          separate: player.separate_from,
        },
        metrics,
        capacity,
      ).filter(
        (s) =>
          !metrics[s.teamIndex].playerIds.some((id) =>
            d.registrations
              .find((r) => r.id === id)
              ?.separate_from.includes(player.id),
          ),
      );
    } catch (e) {
      warning = e instanceof Error ? e.message : "";
    }
  }
  return (
    <section className="admin-card">
      <h2>Sugerencia para un alta tardía</h2>
      <p className="muted">
        Compara cantidad de jugadores, nivel y forwards/backs. No cambia ningún
        plantel hasta que apruebes un destino.
      </p>
      <div className="form-grid">
        <label>
          Jugador sin equipo
          <select
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
          >
            <option value="">Seleccionar jugador habilitado</option>
            {d.registrations
              .filter(
                (r) =>
                  r.active &&
                  r.payment_status === "PAGO_CONFIRMADO" &&
                  !d.members.some((m) => m.registration_id === r.id),
              )
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.first_name} {r.last_name} · {r.level ?? "Sin evaluar"}
                </option>
              ))}
          </select>
        </label>
        <label>
          Capacidad máxima por equipo
          <input
            type="number"
            min={7}
            max={25}
            value={capacity}
            onChange={(e) => setCapacity(+e.target.value)}
          />
        </label>
      </div>
      {warning && <p className="form-alert">{warning}</p>}
      {player && (
        <>
          <label className="check-label">
            <input
              type="checkbox"
              checked={impact}
              onChange={(e) => setImpact(e.target.checked)}
            />
            Revisé el efecto del alta y las reglas de participación del torneo.
          </label>
          {suggestions.map((s, i) => (
            <div className="late-suggestion" key={s.teamIndex}>
              <div>
                <strong>
                  {teams[s.teamIndex].name}
                  {i === 0 ? " · Sugerido" : ""}
                </strong>
                <small>
                  {metrics[s.teamIndex].playerIds.length} jugadores · Nivel{" "}
                  {metrics[s.teamIndex].strength} ·{" "}
                  {metrics[s.teamIndex].forwards} forwards /{" "}
                  {metrics[s.teamIndex].backs} backs
                </small>
              </div>
              <Button
                size="sm"
                disabled={busy || !impact}
                onClick={() =>
                  onApply({
                    type: "member.move",
                    data: {
                      registration_id: player.id,
                      team_id: teams[s.teamIndex].id,
                      captain: false,
                      substitute: true,
                      locked: false,
                      override_lock: false,
                      impact_confirmed: impact,
                    },
                  })
                }
              >
                Aprobar destino
              </Button>
            </div>
          ))}
          {!suggestions.length && !warning && (
            <p className="muted">
              No hay un destino disponible que respete capacidad y
              restricciones.
            </p>
          )}
        </>
      )}
    </section>
  );
}
