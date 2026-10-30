import { describe, it, expect } from "vitest";
import {
  TournamentFormatEngine,
  standings,
  classify,
  resolveSlots,
  validateSchedule,
} from "../src/lib/engines/tournament";
import { DEFAULT_SETTINGS, type Match } from "../src/lib/domain";
const settings = {
  ...DEFAULT_SETTINGS,
  start: "2026-11-21T09:00:00-03:00",
  end: "2026-11-21T23:59:00-03:00",
  courts: 3,
};
const engine = new TournamentFormatEngine();
const plan = (n: number) =>
  engine.generate(
    Array.from({ length: n }, (_, i) => `t${i}`),
    settings,
    { eventId: "event", competitionId: "comp" },
  );
describe("Formatos de torneo 4–24 equipos", () => {
  it("con 12 equipos permite tres partidos de grupos y tres copas con semifinales y final", () => {
    const p = plan(12);
    expect(p.groups.map((g) => g.teamIds.length)).toEqual([4, 4, 4]);
    expect(p.matches.filter((m) => m.phase === "group")).toHaveLength(18);
    for (const id of p.groups.flatMap((g) => g.teamIds))
      expect(
        p.matches.filter(
          (m) => m.phase === "group" && (m.home_id === id || m.away_id === id),
        ),
      ).toHaveLength(3);
    for (const phase of ["gold", "silver", "milk"]) {
      const matches = p.matches.filter((m) => m.phase === phase);
      expect(matches).toHaveLength(3);
      expect(matches.filter((m) => m.round === 1)).toHaveLength(2);
      expect(matches.filter((m) => m.round === 2)).toHaveLength(1);
    }
  });
  it.each(Array.from({ length: 21 }, (_, i) => i + 4))(
    "genera %i equipos sin duplicados, colisiones ni copas vacías",
    (n) => {
      const p = plan(n);
      expect(p.groups.flatMap((g) => g.teamIds).length).toBe(n);
      expect(new Set(p.groups.flatMap((g) => g.teamIds)).size).toBe(n);
      expect(validateSchedule(p.matches, p.settings.restMinutes)).toEqual([]);
      expect(Date.parse(p.endsAt)).toBeLessThanOrEqual(
        Date.parse(p.settings.end),
      );
      const pairs = p.matches
        .filter((m) => m.phase === "group")
        .map((m) => [m.home_id, m.away_id].sort().join(":"));
      expect(new Set(pairs).size).toBe(pairs.length);
      for (const c of p.cups) expect(c.seeds.length).toBeGreaterThanOrEqual(2);
      // Complete actual groups, resolve every future bracket, and recheck real team rest.
      let resolved = p.matches.map((m) =>
        m.phase === "group"
          ? {
              ...m,
              status: "finished" as const,
              home_score: 14,
              away_score: 7,
              winner_id: m.home_id,
            }
          : m,
      );
      const seeds = classify({ ...p, matches: resolved });
      for (let i = 0; i < resolved.length; i++) {
        resolved = resolveSlots(resolved, seeds);
        const ready = resolved.find(
          (m) =>
            m.phase !== "group" &&
            m.status === "scheduled" &&
            m.home_id &&
            m.away_id,
        );
        if (!ready) break;
        ready.status = "finished";
        ready.home_score = 21;
        ready.away_score = 7;
        ready.winner_id = ready.home_id;
      }
      expect(resolved.every((m) => m.status === "finished")).toBe(true);
      expect(validateSchedule(resolved, p.settings.restMinutes)).toEqual([]);
    },
  );
  it("no finge que un torneo cabe en un horario imposible", () =>
    expect(() =>
      engine.generate(
        ["a", "b", "c", "d"],
        { ...settings, end: "2026-11-21T09:01:00-03:00" },
        { eventId: "e", competitionId: "c" },
      ),
    ).toThrow(/no cabe/));
  it("pases directos no crean partidos sin contrincante", () => {
    const p = plan(7);
    expect(p.warnings.join(" ")).toMatch(/pase/);
    expect(
      p.matches
        .filter((m) => m.phase !== "group")
        .every((m) => m.home_source && m.away_source),
    ).toBe(true);
  });
  it("no clasifica antes de terminar los grupos", () =>
    expect(() => classify(plan(8))).toThrow(/Completá/));
  it("calcula posiciones con desempates deterministas", () => {
    const p = plan(4);
    const m = {
      ...p.matches.find((m) => m.phase === "group")!,
      home_id: "t0",
      away_id: "t1",
      home_score: 21,
      away_score: 7,
      status: "finished",
    } as Match;
    const rows = standings(["t0", "t1", "t2", "t3"], [m], settings);
    expect(rows[0]).toMatchObject({
      teamId: "t0",
      played: 1,
      won: 1,
      for: 21,
      against: 7,
      difference: 14,
      points: 3,
    });
    expect(rows.find((r) => r.teamId === "t1")?.lost).toBe(1);
  });
  it("corrige un ganador con protección de fases dependientes", () => {
    const p = plan(8);
    const first = p.matches.find((m) => m.phase === "gold")!;
    const next = p.matches.find(
      (m) =>
        m.home_source === `winner:${first.id}` ||
        m.away_source === `winner:${first.id}`,
    );
    if (next) {
      first.winner_id = "t0";
      next.status = "finished";
      expect(() => resolveSlots(p.matches, {})).toThrow(/afecta/);
    }
  });
  it("detecta conflicto manual de cancha y descanso", () => {
    const p = plan(4);
    p.matches[1].starts_at = p.matches[0].starts_at;
    p.matches[1].court = p.matches[0].court;
    expect(validateSchedule(p.matches, 14).length).toBeGreaterThan(0);
  });
});
