import { describe, it, expect } from "vitest";
import {
  planAutomaticTeams,
  type AutoTeamContext,
} from "../src/lib/engines/automatic-teams";
import type {
  Competition,
  Registration,
  Team,
  Member,
  Match,
} from "../src/lib/domain";
const competition: Competition = {
  id: "comp",
  event_id: "event",
  name: "Seven Interno",
  category_ids: ["all"],
  min_age: 13,
  max_age: 90,
  allow_mixed_ages: true,
  authorization_note: "Authorized mixed Seven",
  version: 0,
  automatic_teams: true,
  auto_team_size: 10,
  auto_team_capacity: 15,
};
const player = (i: number): Registration => ({
  id: `p${i}`,
  event_id: "event",
  player_id: `person${i}`,
  first_name: `Test ${i}`,
  last_name: "Demo",
  age: i % 4 === 0 ? 14 : 20 + (i % 20),
  category_id: "all",
  position_id: i % 7 < 3 ? "f" : "b",
  phone: "0000000000",
  guardian_name: null,
  guardian_phone: null,
  guardian_consent: true,
  public_consent: false,
  payment_status: "PAGO_CONFIRMADO",
  active: true,
  created_at: "",
  version: 0,
  level: (["A", "B", "C"] as const)[i % 3],
  notes: "",
  secondary_positions: [],
  available: true,
  assignment_locked: false,
  excluded: false,
  together_with: [],
  separate_from: [],
});
const context = (n: number): AutoTeamContext => ({
  registrations: Array.from({ length: n }, (_, i) => player(i)),
  teams: [],
  members: [],
  positions: [
    { id: "f", name: "Hooker", group: "forward" },
    { id: "b", name: "Apertura", group: "back" },
  ],
  matches: [],
  event: { state: "BORRADOR" },
});
function allocator() {
  let n = 0;
  return () => `new-team-${++n}`;
}
function apply(ctx: AutoTeamContext) {
  const result = planAutomaticTeams(ctx, competition, allocator());
  const teams = result.plan!.teams;
  return {
    ...ctx,
    teams: teams.map(
      (t) =>
        ({
          id: t.id,
          name: t.name,
          competition_id: "comp",
          published: false,
        }) as Team,
    ),
    members: teams.flatMap((t) =>
      t.members.map(
        (m, i) => ({ ...m, id: `${t.id}-${i}`, team_id: t.id }) as Member,
      ),
    ),
  };
}
describe("Equipos automáticos al confirmar jugadores", () => {
  it("crea el primer equipo aunque todavía no haya siete confirmados", () => {
    const result = planAutomaticTeams(context(1), competition, allocator());
    expect(result.plan?.teams).toHaveLength(1);
    expect(result.plan?.teams[0].members).toHaveLength(1);
  });
  it("crea cuatro equipos al llegar a 32 confirmados y mantiene los IDs anteriores", () => {
    const first = apply(context(20));
    const next = { ...first, registrations: context(32).registrations };
    const result = planAutomaticTeams(
      next,
      competition,
      () => `extra-${Math.random()}`,
    );
    expect(result.plan?.teams).toHaveLength(4);
    for (const team of first.teams)
      expect(result.plan?.teams.some((t) => t.id === team.id)).toBe(true);
    const ids = result.plan!.teams.flatMap((t) =>
      t.members.map((m) => m.registration_id),
    );
    expect(ids).toHaveLength(32);
    expect(new Set(ids).size).toBe(32);
    expect(result.plan!.teams.every((t) => t.members.length >= 7)).toBe(true);
  });
  it("reparte únicamente confirmados activos y disponibles", () => {
    const ctx = context(20);
    ctx.registrations[0].payment_status = "PENDIENTE_PAGO";
    ctx.registrations[1].active = false;
    ctx.registrations[2].available = false;
    const ids = planAutomaticTeams(
      ctx,
      competition,
      allocator(),
    ).plan!.teams.flatMap((t) => t.members.map((m) => m.registration_id));
    expect(ids).toHaveLength(17);
    expect(ids).not.toContain("p0");
    expect(ids).not.toContain("p1");
    expect(ids).not.toContain("p2");
  });
  it("preserva una asignación bloqueada durante el balance de borradores", () => {
    const ctx = apply(context(20));
    const member = ctx.members[0];
    member.locked = true;
    const result = planAutomaticTeams(
      { ...ctx, registrations: context(21).registrations },
      competition,
      () => "extra",
    );
    expect(
      result
        .plan!.teams.find((t) => t.id === member.team_id)
        ?.members.some(
          (m) => m.registration_id === member.registration_id && m.locked,
        ),
    ).toBe(true);
  });
  it("con planteles publicados agrega al nuevo jugador sin mover a los demás", () => {
    const initial = apply(context(20));
    initial.teams[0].published = true;
    const ctx = { ...initial, registrations: context(21).registrations };
    const before = structuredClone(ctx);
    const result = planAutomaticTeams(ctx, competition, allocator());
    expect(result.plan?.mode).toBe("append");
    expect(
      result.plan!.teams.flatMap((t) =>
        t.members.map((m) => m.registration_id),
      ),
    ).toEqual(["p20"]);
    expect(result.plan!.teams.every((t) => !t.is_new)).toBe(true);
    expect(ctx).toEqual(before);
  });
  it("con fixture preparado conserva la estructura aunque todavía no esté publicado", () => {
    const initial = apply(context(20));
    const result = planAutomaticTeams(
      {
        ...initial,
        registrations: context(21).registrations,
        matches: [{ competition_id: "comp" } as Match],
      },
      competition,
      allocator(),
    );
    expect(result.plan?.mode).toBe("append");
    expect(result.plan!.teams).toHaveLength(1);
  });
  it("avisa cuando todos los planteles del fixture alcanzaron la capacidad", () => {
    const initial = apply(context(20));
    initial.teams[0].published = true;
    const result = planAutomaticTeams(
      { ...initial, registrations: context(21).registrations },
      { ...competition, auto_team_capacity: 10 },
      allocator(),
    );
    expect(result.plan).toBeNull();
    expect(result.notice).toContain("esperan asignación");
  });
  it("no actúa si el organizador pausó la asignación automática", () =>
    expect(
      planAutomaticTeams(
        context(20),
        { ...competition, automatic_teams: false },
        allocator(),
      ).plan,
    ).toBeNull());
});
