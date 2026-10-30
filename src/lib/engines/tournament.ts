import type { Match, Standing, TournamentSettings } from "../domain";
export interface FormatPlan {
  groups: { name: string; teamIds: string[] }[];
  matches: Match[];
  cups: { phase: "gold" | "silver" | "milk"; seeds: number[] }[];
  warnings: string[];
  endsAt: string;
  settings: TournamentSettings;
}
type Slot = { id: string | null; source: string | null; possible: string[] };
export function standings(
  teamIds: string[],
  matches: Match[],
  s: TournamentSettings,
): Standing[] {
  const rows = new Map(
    teamIds.map((id) => [
      id,
      {
        teamId: id,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        for: 0,
        against: 0,
        difference: 0,
        points: 0,
      },
    ]),
  );
  for (const m of matches) {
    if (
      m.status !== "finished" ||
      m.home_score === null ||
      m.away_score === null
    )
      continue;
    const h = rows.get(m.home_id ?? ""),
      a = rows.get(m.away_id ?? "");
    if (!h || !a) continue;
    h.played++;
    a.played++;
    h.for += m.home_score;
    h.against += m.away_score;
    a.for += m.away_score;
    a.against += m.home_score;
    if (m.home_score === m.away_score) {
      h.drawn++;
      a.drawn++;
      h.points += s.drawPoints;
      a.points += s.drawPoints;
    } else {
      const w = m.home_score > m.away_score ? h : a,
        l = w === h ? a : h;
      w.won++;
      l.lost++;
      w.points += s.winPoints;
      l.points += s.lossPoints;
    }
  }
  for (const r of rows.values()) r.difference = r.for - r.against;
  return [...rows.values()].sort((a, b) => {
    for (const key of s.tiebreakers) {
      if (a[key] !== b[key]) return b[key] - a[key];
    }
    return a.teamId.localeCompare(b.teamId);
  });
}
export function classify(plan: FormatPlan) {
  const groups = plan.matches.filter((m) => m.phase === "group");
  if (groups.some((m) => m.status !== "finished"))
    throw new Error(
      "Completá todos los partidos de grupos antes de confirmar clasificados.",
    );
  const tables = plan.groups.map((g) =>
    standings(
      g.teamIds,
      groups.filter((m) => m.group_name === g.name),
      plan.settings,
    ),
  );
  const ordered: Standing[] = [];
  for (let rank = 0; rank < Math.max(...tables.map((t) => t.length)); rank++) {
    ordered.push(
      ...tables
        .flatMap((t) => (t[rank] ? [t[rank]] : []))
        .sort((a, b) => {
          const divisor = (r: Standing) =>
            plan.settings.crossGroup === "pointsPerGame"
              ? Math.max(r.played, 1)
              : 1;
          for (const key of plan.settings.tiebreakers) {
            const diff = b[key] / divisor(b) - a[key] / divisor(a);
            if (diff) return diff;
          }
          return a.teamId.localeCompare(b.teamId);
        }),
    );
  }
  return Object.fromEntries(
    plan.cups.flatMap((c) =>
      c.seeds.map((rank, i) => [`${c.phase}:${i + 1}`, ordered[rank].teamId]),
    ),
  );
}
export class TournamentFormatEngine {
  generate(
    teamIds: string[],
    settings: TournamentSettings,
    context: { eventId: string; competitionId: string },
  ): FormatPlan {
    const n = teamIds.length;
    if (n < 4 || n > 24 || new Set(teamIds).size !== n)
      throw new Error("Se necesitan entre 4 y 24 equipos únicos.");
    if (
      !Number.isInteger(settings.courts) ||
      settings.courts < 1 ||
      settings.courts > 8 ||
      !Number.isInteger(settings.matchMinutes) ||
      settings.matchMinutes < 1 ||
      settings.restMinutes < 0 ||
      !Number.isInteger(settings.minMatches) ||
      settings.minMatches < 1
    )
      throw new Error("Revisá canchas, duración, descanso y partidos mínimos.");
    const start = Date.parse(settings.start),
      end = Date.parse(settings.end);
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end <= start ||
      end - start > 86400000
    )
      throw new Error(
        "Ingresá un horario válido dentro de una jornada de 24 horas.",
      );
    const candidates: FormatPlan[] = [];
    for (let groupCount = 1; groupCount <= Math.floor(n / 3); groupCount++) {
      const minSize = Math.floor(n / groupCount);
      const requested = (["gold", "silver", "milk"] as const).filter(
        (c) => settings[c],
      );
      const cups = requested.slice(
        0,
        Math.min(requested.length, Math.floor(n / 2)),
      );
      if (minSize - 1 + (cups.length ? 1 : 0) < settings.minMatches) continue;
      try {
        candidates.push(
          this.plan(teamIds, groupCount, cups, settings, context, start, end),
        );
      } catch {
        /* Another candidate can fit. */
      }
    }
    if (!candidates.length)
      throw new Error(
        "El torneo no cabe con estas condiciones. Sumá canchas o tiempo, reducí la duración, el descanso o los partidos mínimos. No se guardó ningún fixture.",
      );
    return candidates.sort((a, b) => {
      const quality = (p: FormatPlan) =>
        Math.abs(n / p.groups.length - 4) * 100 +
        (Date.parse(p.endsAt) - start) / 60000;
      return quality(a) - quality(b);
    })[0];
  }
  private plan(
    ids: string[],
    count: number,
    cupPhases: ("gold" | "silver" | "milk")[],
    s: TournamentSettings,
    ctx: { eventId: string; competitionId: string },
    start: number,
    end: number,
  ): FormatPlan {
    const groups = Array.from({ length: count }, (_, i) => ({
      name: String.fromCharCode(65 + i),
      teamIds: ids.filter((_, j) => j % count === i),
    }));
    const matches: Match[] = [];
    const busy = new Map<string, number>();
    const courts = Array(s.courts).fill(start) as number[];
    const duration = s.matchMinutes * 60000,
      rest = s.restMinutes * 60000;
    function add(
      home: Slot,
      away: Slot,
      phase: Match["phase"],
      group: string | null,
      round: number,
      earliest = start,
    ): Slot {
      const possible = [...new Set([...home.possible, ...away.possible])];
      const ready = Math.max(
        earliest,
        ...possible.map((id) => busy.get(id) ?? start),
      );
      const court = courts.indexOf(Math.min(...courts));
      const at = Math.max(ready, courts[court]);
      if (at + duration > end) throw new Error("Horario insuficiente.");
      const id = `${ctx.competitionId}-${phase}-${matches.length + 1}`;
      matches.push({
        id,
        event_id: ctx.eventId,
        competition_id: ctx.competitionId,
        number: matches.length + 1,
        phase,
        group_name: group,
        round,
        home_id: home.id,
        away_id: away.id,
        home_source: home.source,
        away_source: away.source,
        starts_at: new Date(at).toISOString(),
        court: court + 1,
        duration: s.matchMinutes,
        status: "scheduled",
        home_score: null,
        away_score: null,
        winner_id: null,
        published: false,
        version: 0,
      });
      courts[court] = at + duration;
      for (const team of possible) busy.set(team, at + duration + rest);
      return { id: null, source: `winner:${id}`, possible };
    }
    // Circle method: every unordered pair occurs exactly once, including odd groups.
    const rounds = groups.map((g) => {
      const ring: (string | null)[] = [...g.teamIds];
      if (ring.length % 2) ring.push(null);
      const result: [string, string][][] = [];
      for (let r = 0; r < ring.length - 1; r++) {
        const pairs: [string, string][] = [];
        for (let i = 0; i < ring.length / 2; i++) {
          const a = ring[i],
            b = ring[ring.length - 1 - i];
          if (a && b) pairs.push([a, b]);
        }
        result.push(pairs);
        ring.splice(1, 0, ring.pop()!);
      }
      return result;
    });
    for (let r = 0; r < Math.max(...rounds.map((x) => x.length)); r++)
      for (let g = 0; g < groups.length; g++)
        for (const [a, b] of rounds[g][r] ?? [])
          add(
            { id: a, source: null, possible: [a] },
            { id: b, source: null, possible: [b] },
            "group",
            groups[g].name,
            r + 1,
          );
    const groupEnd =
      Math.max(...matches.map((m) => Date.parse(m.starts_at) + duration)) +
      rest;
    const warnings: string[] = [];
    if (new Set(groups.map((g) => g.teamIds.length)).size > 1)
      warnings.push(
        "Grupos de tamaños diferentes: comparación entre grupos según la regla configurada.",
      );
    if (cupPhases.length < Number(s.gold) + Number(s.silver) + Number(s.milk))
      warnings.push(
        "Se redujo la cantidad de copas para que todas tengan al menos dos equipos.",
      );
    const cups = cupPhases.map((phase, i) => ({
      phase,
      seeds: ids
        .map((_, j) => j)
        .slice(
          Math.floor((i * ids.length) / cupPhases.length),
          Math.floor(((i + 1) * ids.length) / cupPhases.length),
        ),
    }));
    for (const cup of cups) {
      // Seed identities are disjoint even before group winners are known. This
      // allows concurrent cups while preserving rest for every possible path.
      const slots: Slot[] = cup.seeds.map((_, i) => ({
        id: null,
        source: `seed:${cup.phase}:${i + 1}`,
        possible: [`seed:${cup.phase}:${i + 1}`],
      }));
      const size = 2 ** Math.ceil(Math.log2(slots.length));
      const order = (n: number): number[] =>
        n === 2 ? [1, 2] : order(n / 2).flatMap((seed) => [seed, n + 1 - seed]);
      const seeded: (Slot | null)[] = order(size).map(
        (seed) => slots[seed - 1] ?? null,
      );
      let current = seeded,
        round = 1;
      while (current.length > 1) {
        const next: (Slot | null)[] = [];
        for (let i = 0; i < current.length; i += 2) {
          const a = current[i],
            b = current[i + 1];
          if (a && b) next.push(add(a, b, cup.phase, null, round, groupEnd));
          else next.push(a ?? b);
        }
        current = next;
        round++;
      }
      if (size > cup.seeds.length)
        warnings.push(
          `Copa ${cup.phase === "gold" ? "de Oro" : cup.phase === "silver" ? "de Plata" : "de Leche"}: ${size - cup.seeds.length} pase(s) directo(s), por orden de clasificación.`,
        );
    }
    return {
      groups,
      matches,
      cups,
      warnings,
      endsAt: new Date(
        Math.max(...matches.map((m) => Date.parse(m.starts_at) + duration)),
      ).toISOString(),
      settings: s,
    };
  }
}
export function resolveSlots(
  matches: Match[],
  seeds: Record<string, string>,
): Match[] {
  const resolved = matches.map((m) => ({ ...m }));
  for (let step = 0; step < resolved.length; step++) {
    let changed = false;
    for (const m of resolved)
      for (const side of ["home", "away"] as const) {
        const source = m[`${side}_source`];
        if (!source) continue;
        const next = source.startsWith("seed:")
          ? (seeds[source.slice(5)] ?? null)
          : (resolved.find((x) => x.id === source.slice(7))?.winner_id ?? null);
        if (m[`${side}_id`] !== next) {
          if (m.status !== "scheduled")
            throw new Error(
              "El cambio afecta un partido iniciado o terminado. Confirmá primero la anulación de sus resultados dependientes.",
            );
          m[`${side}_id`] = next;
          changed = true;
        }
      }
    if (!changed) break;
  }
  return resolved;
}
export function validateSchedule(matches: Match[], restMinutes: number) {
  const errors: string[] = [];
  const byId = new Map(matches.map((m) => [m.id, m]));
  const paths = (m: Match, visited = new Set<string>()): string[] => {
    if (visited.has(m.id)) return [];
    const next = new Set(visited).add(m.id);
    return (["home", "away"] as const).flatMap((side) => {
      const id = m[`${side}_id`],
        source = m[`${side}_source`];
      if (id) return [`team:${id}`];
      if (source?.startsWith("seed:")) return [`${m.competition_id}:${source}`];
      if (source?.startsWith("winner:")) {
        const parent = byId.get(source.slice(7));
        return parent ? paths(parent, next) : [];
      }
      return [];
    });
  };
  for (const m of matches) {
    for (const source of [m.home_source, m.away_source])
      if (source?.startsWith("winner:")) {
        const parent = byId.get(source.slice(7));
        if (
          parent &&
          Date.parse(m.starts_at) <
            Date.parse(parent.starts_at) +
              (parent.duration + restMinutes) * 60000
        )
          errors.push(
            `El partido ${m.number} debe esperar el resultado y descanso del partido ${parent.number}.`,
          );
      }
    if (m.phase !== "group") {
      const groups = matches.filter(
        (g) => g.competition_id === m.competition_id && g.phase === "group",
      );
      if (
        groups.some(
          (g) =>
            Date.parse(g.starts_at) + (g.duration + restMinutes) * 60000 >
            Date.parse(m.starts_at),
        )
      )
        errors.push(
          `La copa del partido ${m.number} debe comenzar después de la fase de grupos y el descanso.`,
        );
    }
  }
  for (let i = 0; i < matches.length; i++)
    for (let j = i + 1; j < matches.length; j++) {
      const a = matches[i],
        b = matches[j];
      const ta = Date.parse(a.starts_at),
        tb = Date.parse(b.starts_at);
      if (
        ta < tb + b.duration * 60000 &&
        tb < ta + a.duration * 60000 &&
        a.court === b.court
      )
        errors.push(`Cancha ocupada en partidos ${a.number} y ${b.number}.`);
      const shared = paths(a).some((token) => paths(b).includes(token));
      if (
        shared &&
        ta < tb + (b.duration + restMinutes) * 60000 &&
        tb < ta + (a.duration + restMinutes) * 60000
      )
        errors.push(
          `Descanso insuficiente en partidos ${a.number} y ${b.number}.`,
        );
    }
  return errors;
}
