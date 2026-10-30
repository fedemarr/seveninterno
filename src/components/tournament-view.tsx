import type { Match, Team } from "@/lib/domain";
import type { FormatPlan } from "@/lib/engines/tournament";
import { standings } from "@/lib/engines/tournament";
import { time } from "@/lib/utils";
import { Trophy, Clock3 } from "lucide-react";
export const phaseName = (p: string) =>
  ({
    group: "Fase de grupos",
    gold: "Copa de Oro",
    silver: "Copa de Plata",
    milk: "Copa de Leche",
  })[p] ?? p;
export function teamLabel(
  id: string | null,
  source: string | null,
  teams: Team[],
  matches: Match[] = [],
): string {
  if (id) return teams.find((t) => t.id === id)?.name ?? "Equipo por confirmar";
  if (source?.startsWith("winner:"))
    return `Ganador partido ${matches.find((m) => m.id === source.slice(7))?.number ?? "por definir"}`;
  if (source?.startsWith("seed:")) {
    const [, phase, rank] = source.split(":");
    return `${rank}° clasificado · ${phaseName(phase)}`;
  }
  return "Por definir";
}
export function MatchCard({
  match: m,
  teams,
  matches,
}: {
  match: Match;
  teams: Team[];
  matches: Match[];
}) {
  return (
    <article className={`match-card ${m.status === "live" ? "is-live" : ""}`}>
      <div className="match-meta">
        <span>
          #{String(m.number).padStart(2, "0")} ·{" "}
          {m.group_name ? `GRUPO ${m.group_name}` : phaseName(m.phase)}
        </span>
        <b>
          {m.status === "live"
            ? "● EN JUEGO"
            : m.status === "finished"
              ? "FINALIZADO"
              : `${time(m.starts_at)} HS`}
        </b>
      </div>
      <div className="match-team">
        <span>
          <i
            style={{
              background:
                teams.find((t) => t.id === m.home_id)?.color ?? "#8a9db8",
            }}
          />
          {teamLabel(m.home_id, m.home_source, teams, matches)}
        </span>
        <strong>{m.home_score ?? "–"}</strong>
      </div>
      <div className="match-team">
        <span>
          <i
            style={{
              background:
                teams.find((t) => t.id === m.away_id)?.color ?? "#8a9db8",
            }}
          />
          {teamLabel(m.away_id, m.away_source, teams, matches)}
        </span>
        <strong>{m.away_score ?? "–"}</strong>
      </div>
      <div className="match-footer">
        <Clock3 size={13} /> Cancha {m.court} · {m.duration} min{" "}
        {m.winner_id && m.phase !== "group" && (
          <b>Ganador: {teams.find((t) => t.id === m.winner_id)?.name}</b>
        )}
      </div>
    </article>
  );
}
export function StandingsTables({
  plans,
  teams,
  matches,
}: {
  plans: { competition_id: string; plan: FormatPlan }[];
  teams: Team[];
  matches: Match[];
}) {
  return (
    <div className="tables-grid">
      {plans.flatMap(({ competition_id, plan }) =>
        plan.groups.map((group) => (
          <section
            className="standings-panel"
            key={`${competition_id}-${group.name}`}
          >
            <h3>GRUPO {group.name}</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Equipo</th>
                    {["PJ", "PG", "PE", "PP", "PF", "PC", "DIF", "PTS"].map(
                      (x) => (
                        <th key={x}>{x}</th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {standings(
                    group.teamIds,
                    matches.filter(
                      (m) =>
                        m.competition_id === competition_id &&
                        m.phase === "group" &&
                        m.group_name === group.name,
                    ),
                    plan.settings,
                  ).map((r, i) => (
                    <tr key={r.teamId}>
                      <td>
                        <span className="rank">{i + 1}</span>
                        {teams.find((t) => t.id === r.teamId)?.name}
                      </td>
                      {[
                        r.played,
                        r.won,
                        r.drawn,
                        r.lost,
                        r.for,
                        r.against,
                        r.difference,
                        r.points,
                      ].map((v, j) => (
                        <td key={j}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <small>
              Victoria {plan.settings.winPoints} · Empate{" "}
              {plan.settings.drawPoints} · Derrota {plan.settings.lossPoints}
            </small>
          </section>
        )),
      )}
    </div>
  );
}
export function CupBrackets({
  matches,
  teams,
}: {
  matches: Match[];
  teams: Team[];
}) {
  return (
    <div className="cups">
      {(["gold", "silver", "milk"] as const).map((phase) => {
        const cup = matches.filter((m) => m.phase === phase);
        if (!cup.length) return null;
        const rounds = [...new Set(cup.map((m) => m.round))].sort(
          (a, b) => a - b,
        );
        const final = cup.find((m) => m.round === Math.max(...rounds));
        return (
          <section className={`cup-section ${phase}`} key={phase}>
            <h2>
              <Trophy size={24} />
              {phaseName(phase)}
            </h2>
            {final?.status === "finished" && final.winner_id && (
              <div className="champion">
                <Trophy size={32} />
                <span>
                  CAMPEÓN
                  <strong>
                    {teams.find((t) => t.id === final.winner_id)?.name}
                  </strong>
                </span>
              </div>
            )}
            <div className="bracket-scroll">
              {rounds.map((round) => (
                <div className="bracket-round" key={round}>
                  <p>
                    {round === Math.max(...rounds)
                      ? "FINAL"
                      : round === Math.max(...rounds) - 1
                        ? "SEMIFINALES"
                        : "CUARTOS"}
                  </p>
                  {cup
                    .filter((m) => m.round === round)
                    .map((m) => (
                      <MatchCard
                        key={m.id}
                        match={m}
                        teams={teams}
                        matches={matches}
                      />
                    ))}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
