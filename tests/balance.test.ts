import { describe, it, expect } from "vitest";
import {
  generateBalancedTeams,
  suggestLateTeam,
  type BalancePlayer,
} from "../src/lib/engines/balance";
const players = (n: number): BalancePlayer[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    level: (["A", "B", "C"] as const)[i % 3],
    group: i % 7 < 3 ? "forward" : "back",
    position: i % 7 === 3 ? "Medio scrum" : "Wing",
    paid: true,
    eligible: true,
    available: true,
  }));
const options = { playersPerTeam: 7, substitutes: 3, seed: 42 };
describe("Motor de equipos", () => {
  it("es reproducible y reparte jugadores sin duplicados", () => {
    const a = generateBalancedTeams(players(31), options),
      b = generateBalancedTeams(players(31), options);
    expect(a).toEqual(b);
    const ids = a.teams.flatMap((t) => t.playerIds);
    expect(new Set(ids).size).toBe(31);
    expect(
      Math.max(...a.teams.map((t) => t.playerIds.length)) -
        Math.min(...a.teams.map((t) => t.playerIds.length)),
    ).toBeLessThanOrEqual(1);
  });
  it("excluye impagos, no elegibles y no disponibles", () => {
    const list = players(24);
    list[0].paid = false;
    list[1].eligible = false;
    list[2].available = false;
    expect(
      generateBalancedTeams(list, options).teams.flatMap((t) => t.playerIds),
    ).not.toEqual(expect.arrayContaining(["p0", "p1", "p2"]));
    expect(
      generateBalancedTeams(list, options).teams.flatMap((t) => t.playerIds)
        .length,
    ).toBe(21);
  });
  it("respeta juntos, separados y bloqueos", () => {
    const list = players(28);
    list[0].together = ["p1"];
    list[0].lockedTeam = 0;
    list[2].separate = ["p0"];
    const r = generateBalancedTeams(list, { ...options, teamCount: 4 });
    expect(r.teams[0].playerIds).toEqual(expect.arrayContaining(["p0", "p1"]));
    expect(r.teams[0].playerIds).not.toContain("p2");
  });
  it("rechaza restricciones contradictorias", () => {
    const list = players(14);
    list[0].together = ["p1"];
    list[0].separate = ["p1"];
    expect(() => generateBalancedTeams(list, options)).toThrow(
      /contradictorias/,
    );
  });
  it("advierte evaluaciones sin definir", () => {
    const list = players(14);
    list[0].level = null;
    expect(generateBalancedTeams(list, options).warnings.join(" ")).toMatch(
      /sin evaluar/,
    );
  });
  it("no modifica planteles publicados al sugerir un alta tardía", () => {
    const teams = generateBalancedTeams(players(28), {
      ...options,
      teamCount: 4,
    }).teams;
    const before = structuredClone(teams);
    expect(suggestLateTeam(players(1)[0], teams, 10).length).toBe(4);
    expect(teams).toEqual(before);
  });
  it("falla si no alcanza la cantidad mínima", () =>
    expect(() => generateBalancedTeams(players(13), options)).toThrow(
      /cantidad/,
    ));
});
