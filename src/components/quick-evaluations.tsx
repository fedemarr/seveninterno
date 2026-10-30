"use client";
import { useState } from "react";
import { Search, Check } from "lucide-react";
import type { Registration } from "@/lib/domain";

export function QuickEvaluations({
  players,
  busy,
  readOnly,
  onRate,
}: {
  players: Registration[];
  busy: boolean;
  readOnly: boolean;
  onRate: (player: Registration, level: "A" | "B" | "C") => void;
}) {
  const [search, setSearch] = useState("");
  const active = players.filter((p) => p.active);
  const visible = active
    .filter((p) =>
      `${p.first_name} ${p.last_name}`
        .toLocaleLowerCase("es")
        .includes(search.toLocaleLowerCase("es")),
    )
    .sort(
      (a, b) =>
        a.last_name.localeCompare(b.last_name, "es") ||
        a.first_name.localeCompare(b.first_name, "es"),
    );
  const evaluated = active.filter((p) => p.level).length;
  return (
    <section className="admin-card quick-evaluations">
      <div className="evaluation-heading">
        <div>
          <h2>Nombre, nivel y listo.</h2>
          <p>Tocá A, B o C. Se guarda automáticamente.</p>
        </div>
        <span>
          {evaluated} de {active.length} evaluados
        </span>
      </div>
      <div className="evaluation-toolbar">
        <label className="search-input">
          <span className="sr-only">Buscar jugador</span>
          <Search size={17} />
          <input
            type="search"
            placeholder="Buscar jugador por nombre"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <p>
          <strong>A</strong> Alto <span>·</span> <strong>B</strong> Intermedio{" "}
          <span>·</span> <strong>C</strong> Inicial
        </p>
      </div>
      <ul className="evaluation-list">
        {visible.map((player) => (
          <li key={player.id}>
            <div className="evaluation-player">
              <strong>
                {player.first_name} {player.last_name}
              </strong>
              <small>
                {player.level ? (
                  <>
                    <Check size={13} /> Nivel {player.level} guardado
                  </>
                ) : (
                  "Sin evaluar"
                )}
              </small>
            </div>
            <div
              className="evaluation-options"
              role="group"
              aria-label={`Nivel de ${player.first_name} ${player.last_name}`}
            >
              {(["A", "B", "C"] as const).map((level) => (
                <button
                  type="button"
                  key={level}
                  className={`evaluation-option ${player.level === level ? "selected" : ""}`}
                  aria-pressed={player.level === level}
                  aria-label={`Asignar nivel ${level} a ${player.first_name} ${player.last_name}`}
                  disabled={busy || readOnly}
                  onClick={() => {
                    if (player.level !== level) onRate(player, level);
                  }}
                >
                  {level}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {!visible.length && (
        <p className="evaluation-empty">
          {active.length
            ? "No encontramos jugadores con ese nombre."
            : "Todavía no hay jugadores para evaluar."}
        </p>
      )}
      <p className="evaluation-private-note">
        Estos niveles solo los ve la organización.
      </p>
    </section>
  );
}
