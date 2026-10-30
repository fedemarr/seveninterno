import { describe, it, expect } from "vitest";
import {
  validateRosterPlacement,
  type PlacementContext,
} from "../src/lib/roster-placement";
import type {
  Registration,
  Team,
  Competition,
  Member,
} from "../src/lib/domain";
import { commandSchema } from "../src/lib/commands";
const player = {
  id: "p1",
  event_id: "event",
  active: true,
  available: true,
  excluded: false,
  payment_status: "PAGO_CONFIRMADO",
  category_id: "all",
  age: 25,
  together_with: [],
  separate_from: [],
} as unknown as Registration;
const team = { id: "team", event_id: "event", competition_id: "comp" } as Team;
const context = (): PlacementContext => ({
  registrations: [player],
  teams: [team],
  competitions: [
    {
      id: "comp",
      category_ids: ["all"],
      min_age: 13,
      max_age: 90,
      auto_team_capacity: 7,
    } as Competition,
  ],
  members: [],
});
describe("Movimientos manuales y altas presenciales", () => {
  it("permite asignar un jugador confirmado elegible", () =>
    expect(() =>
      validateRosterPlacement(context(), player, team),
    ).not.toThrow());
  it("rechaza jugadores pendientes de pago", () =>
    expect(() =>
      validateRosterPlacement(
        context(),
        { ...player, payment_status: "PENDIENTE_PAGO" },
        team,
      ),
    ).toThrow(/habilitado/));
  it("rechaza un destino lleno", () => {
    const ctx = context();
    ctx.members = Array.from(
      { length: 7 },
      (_, i) => ({ team_id: "team", registration_id: `other${i}` }) as Member,
    );
    expect(() => validateRosterPlacement(ctx, player, team)).toThrow(
      /capacidad/,
    );
  });
  it("editar una asignación propia no ocupa una plaza adicional", () => {
    const ctx = context();
    ctx.members = Array.from(
      { length: 7 },
      (_, i) =>
        ({
          team_id: "team",
          registration_id: i === 0 ? "p1" : `other${i}`,
        }) as Member,
    );
    expect(() => validateRosterPlacement(ctx, player, team)).not.toThrow();
  });
  it("respeta las restricciones de separación recíprocas", () => {
    const ctx = context();
    ctx.members = [{ team_id: "team", registration_id: "p2" } as Member];
    ctx.registrations.push({ ...player, id: "p2", separate_from: ["p1"] });
    expect(() => validateRosterPlacement(ctx, player, team)).toThrow(
      /separación/,
    );
  });
  it("impide separar a jugadores que deben permanecer juntos", () =>
    expect(() =>
      validateRosterPlacement(
        context(),
        { ...player, together_with: ["p2"] },
        team,
      ),
    ).toThrow(/juntos/));
  it("exige pago confirmado para elegir equipo en el alta presencial", () => {
    const input = {
      first_name: "Prueba",
      last_name: "Alta",
      age: 25,
      category_id: "00000000-0000-4000-8000-000000000001",
      position_id: "00000000-0000-4000-8000-000000000002",
      phone: "0000000000",
      consent: true,
      public_consent: false,
      website: "",
    };
    const data = {
      input,
      competition_id: "00000000-0000-4000-8000-000000000003",
      payment_confirmed: false,
      level: "B",
      team_id: "00000000-0000-4000-8000-000000000004",
    };
    expect(
      commandSchema.safeParse({
        version: 0,
        command: { type: "player.onsite.create", data },
      }).success,
    ).toBe(false);
    expect(
      commandSchema.safeParse({
        version: 0,
        command: {
          type: "player.onsite.create",
          data: { ...data, payment_confirmed: true },
        },
      }).success,
    ).toBe(true);
  });
});
