import { describe, it, expect } from "vitest";
import {
  competitionPresets,
  eligibleForCompetition,
} from "../src/lib/competition-setup";
import type {
  Category,
  Competition,
  Registration,
  Team,
  Member,
} from "../src/lib/domain";
const categories: Category[] = [
  {
    id: "superior",
    name: "Plantel Superior",
    min_age: 18,
    max_age: 90,
    minor: false,
  },
  { id: "pad", name: "PADRENCES", min_age: 18, max_age: 90, minor: false },
  { id: "vet", name: "Veteranos", min_age: 35, max_age: 90, minor: false },
  { id: "m14", name: "M14", min_age: 13, max_age: 14, minor: true },
  { id: "m19", name: "M19", min_age: 17, max_age: 19, minor: false },
];
const competition = {
  id: "adults",
  category_ids: ["superior", "pad", "vet"],
  min_age: 18,
  max_age: 90,
} as Competition;
const player = {
  id: "player",
  active: true,
  available: true,
  excluded: false,
  payment_status: "PAGO_CONFIRMADO",
  category_id: "pad",
  age: 35,
} as Registration;
describe("Preparación del generador", () => {
  it("prepara un solo Seven con todas las categorías y autorización explícita", () => {
    const presets = competitionPresets(categories);
    expect(presets).toHaveLength(1);
    expect(presets[0]).toMatchObject({
      name: "Seven Interno",
      category_ids: ["superior", "pad", "vet", "m14", "m19"],
      min_age: 13,
      max_age: 90,
      allow_mixed_ages: true,
    });
    expect(presets[0].authorization_note.length).toBeGreaterThan(10);
  });
  it("incluye tanto M14 como Veteranos en el mismo Seven autorizado", () => {
    const mixed = { ...competition, ...competitionPresets(categories)[0] };
    expect(
      eligibleForCompetition(
        { ...player, age: 14, category_id: "m14" },
        mixed,
        [],
        [],
      ),
    ).toBe(true);
    expect(
      eligibleForCompetition(
        { ...player, age: 60, category_id: "vet" },
        mixed,
        [],
        [],
      ),
    ).toBe(true);
  });
  it("cuenta como habilitado a un adulto confirmado", () =>
    expect(eligibleForCompetition(player, competition, [], [])).toBe(true));
  it.each([
    { payment_status: "PENDIENTE_PAGO" },
    { active: false },
    { available: false },
    { excluded: true },
    { age: 17 },
    { category_id: "m14" },
  ])("excluye jugadores no habilitados %j", (patch) =>
    expect(
      eligibleForCompetition(
        { ...player, ...patch } as Registration,
        competition,
        [],
        [],
      ),
    ).toBe(false),
  );
  it("excluye integrantes de otra competencia pero permite propuestas de su competencia", () => {
    const member = { registration_id: "player", team_id: "team" } as Member;
    expect(
      eligibleForCompetition(
        player,
        competition,
        [{ id: "team", competition_id: "other" } as Team],
        [member],
      ),
    ).toBe(false);
    expect(
      eligibleForCompetition(
        player,
        competition,
        [{ id: "team", competition_id: "adults" } as Team],
        [member],
      ),
    ).toBe(true);
  });
});
