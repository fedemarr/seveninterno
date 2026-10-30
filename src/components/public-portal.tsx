"use client";
import { useState } from "react";
import { Trophy, Users, CalendarDays, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { PublicSnapshot } from "@/lib/data";
import { MatchCard, StandingsTables, CupBrackets } from "./tournament-view";
import { AutoRefresh } from "./auto-refresh";
export function PublicPortal({
  data,
  section,
}: {
  data: PublicSnapshot;
  section: string;
}) {
  const [competition, setCompetition] = useState(""),
    [filter, setFilter] = useState("all");
  const teams = data.teams.filter(
      (t) => !competition || t.competition_id === competition,
    ),
    matches = data.matches.filter(
      (m) => !competition || m.competition_id === competition,
    ),
    plans = data.plans.filter(
      (p) => !competition || p.competition_id === competition,
    );
  const labels: Record<
    string,
    { eyebrow: string; title: string; accent: string; description: string }
  > = {
    equipos: {
      eyebrow: "LOS PROTAGONISTAS",
      title: "La misma",
      accent: "camiseta.",
      description:
        "Conocé los equipos y los planteles publicados por la organización.",
    },
    fixture: {
      eyebrow: "EL SEVEN, PARTIDO A PARTIDO",
      title: "Nos vemos en",
      accent: "la cancha.",
      description:
        "Horarios, canchas, próximos partidos y resultados del torneo.",
    },
    posiciones: {
      eyebrow: "CADA PUNTO CUENTA",
      title: "El camino a",
      accent: "las copas.",
      description:
        "Seguí los grupos y las posiciones, con las reglas de esta edición.",
    },
    copas: {
      eyebrow: "HASTA EL ÚLTIMO TRY",
      title: "El Seven tiene",
      accent: "sus copas.",
      description:
        "Cruces, clasificados y campeones. Todo se define en la cancha.",
    },
  };
  const l = labels[section];
  const visible = matches.filter(
    (m) => filter === "all" || m.status === filter,
  );
  const empty =
    section === "equipos"
      ? !teams.length
      : section === "posiciones"
        ? !plans.length
        : section === "copas"
          ? !matches.some((m) => m.phase !== "group")
          : !matches.length;
  return (
    <>
      <AutoRefresh />
      <div className="portal-heading">
        <p className="eyebrow yellow">{l.eyebrow}</p>
        <h1>
          {l.title} <span>{l.accent}</span>
        </h1>
        <p>{l.description}</p>
        <small className="update-note">
          <span className="status-dot" /> Se actualiza cada 20 segundos
        </small>
      </div>
      <nav className="portal-tabs" aria-label="Secciones del torneo">
        {Object.entries({
          equipos: "Equipos",
          fixture: "Fixture y resultados",
          posiciones: "Posiciones",
          copas: "Copas",
        }).map(([path, name]) => (
          <Link
            key={path}
            href={`/${path}`}
            aria-current={section === path ? "page" : undefined}
          >
            {name}
          </Link>
        ))}
      </nav>
      <div className="portal-toolbar">
        <label>
          Competencia
          <select
            value={competition}
            onChange={(e) => setCompetition(e.target.value)}
          >
            <option value="">Todas las competencias</option>
            {data.competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {section === "fixture" && (
          <label>
            Mostrar
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">Todos los partidos</option>
              <option value="scheduled">Próximos partidos</option>
              <option value="live">En juego</option>
              <option value="finished">Resultados</option>
            </select>
          </label>
        )}
      </div>
      {empty ? (
        <div className="public-empty">
          {section === "equipos" ? (
            <Users size={48} strokeWidth={1} />
          ) : section === "fixture" ? (
            <CalendarDays size={48} strokeWidth={1} />
          ) : (
            <Trophy size={48} strokeWidth={1} />
          )}
          <h2>
            {section === "equipos"
              ? "Los equipos se están preparando."
              : section === "fixture"
                ? "El fixture todavía no se publicó."
                : section === "posiciones"
                  ? "Las posiciones van a aparecer acá."
                  : "Las copas están por definirse."}
          </h2>
          <p>
            La organización publicará la información cuando esté confirmada.
            <br />
            Mientras tanto, preparate para ser parte del Seven.
          </p>
          <Link href="/inscripcion" className="btn btn-primary">
            Ir a la inscripción <ArrowUpRight size={18} />
          </Link>
        </div>
      ) : (
        <>
          {section === "equipos" && (
            <div className="teams-grid">
              {teams.map((t, i) => (
                <article
                  className="team-card"
                  key={t.id}
                  style={{ "--team-color": t.color } as React.CSSProperties}
                >
                  <div className="team-identity">
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <h2>{t.name}</h2>
                    <small>
                      {
                        data.competitions.find((c) => c.id === t.competition_id)
                          ?.name
                      }
                    </small>
                  </div>
                  <div className="team-roster">
                    {data.members
                      .filter((m) => m.team_id === t.id)
                      .map((m, j) => (
                        <p key={j}>
                          {m.name}
                          {m.captain && <b>CAPITÁN</b>}
                          {m.substitute && <small>Suplente</small>}
                        </p>
                      ))}
                    {!data.members.some((m) => m.team_id === t.id) && (
                      <p>Plantel reservado por privacidad.</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
          {section === "fixture" && (
            <div className="matches-grid">
              {visible.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  teams={teams}
                  matches={matches}
                />
              ))}
              {!visible.length && <p>No hay partidos con este estado.</p>}
            </div>
          )}
          {section === "posiciones" && (
            <StandingsTables plans={plans} teams={teams} matches={matches} />
          )}
          {section === "copas" && (
            <CupBrackets matches={matches} teams={teams} />
          )}
        </>
      )}
    </>
  );
}
