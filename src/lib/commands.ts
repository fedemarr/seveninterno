import { z } from "zod";
import { EVENT_STATES, PAYMENT_STATES } from "./domain";
import { registrationSchema } from "./validation";
const id = z.uuid();
const ids = z.array(id).max(500);
export const settingsSchema = z.object({
  courts: z.number().int().min(1).max(8),
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
  matchMinutes: z.number().int().min(1).max(60),
  restMinutes: z.number().int().min(0).max(120),
  minMatches: z.number().int().min(1).max(10),
  gold: z.boolean(),
  silver: z.boolean(),
  milk: z.boolean(),
  winPoints: z.number().int().min(0).max(10),
  drawPoints: z.number().int().min(0).max(10),
  lossPoints: z.number().int().min(0).max(10),
  tiebreakers: z
    .array(z.enum(["points", "difference", "for", "won"]))
    .min(1)
    .max(4),
  crossGroup: z.enum(["pointsPerGame", "points"]),
});
export const commandSchema = z.object({
  version: z.number().int().min(0),
  command: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("event.update"),
      data: z.object({
        name: z.string().trim().min(2).max(100),
        edition: z.string().trim().min(2).max(140),
        state: z.enum(EVENT_STATES),
        registration_open: z.boolean(),
        late_registration: z.boolean(),
        amount: z.number().min(0).max(10000000),
        alias: z.string().max(100),
        holder: z.string().max(120),
        bank_account: z.string().max(100),
        payment_instructions: z.string().max(1000),
        event_date: z.string().max(10).nullable(),
      }),
    }),
    z.object({
      type: z.literal("payment.update"),
      data: z.object({ id, status: z.enum(PAYMENT_STATES) }),
    }),
    z.object({
      type: z.literal("player.update"),
      data: z.object({
        id,
        active: z.boolean(),
        level: z.enum(["A", "B", "C", ""]),
        notes: z.string().max(2000),
        secondary_positions: z.array(z.string().max(50)).max(12),
        available: z.boolean(),
        assignment_locked: z.boolean(),
        excluded: z.boolean(),
        together_with: ids,
        separate_from: ids,
      }),
    }),
    z.object({ type: z.literal("player.create"), data: registrationSchema }),
    z.object({
      type: z.literal("player.details"),
      data: z.object({ id, input: registrationSchema }),
    }),
    z.object({
      type: z.literal("event.create"),
      data: z.object({
        name: z.string().trim().min(2).max(100),
        edition: z.string().trim().min(2).max(140),
      }),
    }),
    z.object({
      type: z.literal("member.swap"),
      data: z.object({
        first_id: id,
        second_id: id,
        override_lock: z.boolean(),
        impact_confirmed: z.boolean(),
      }),
    }),
    z.object({
      type: z.literal("competition.create"),
      data: z.object({
        name: z.string().trim().min(2).max(80),
        category_ids: ids.min(1),
        min_age: z.number().int().min(13).max(90),
        max_age: z.number().int().min(13).max(90),
        allow_mixed_ages: z.boolean(),
        authorization_note: z.string().max(500),
      }),
    }),
    z.object({
      type: z.enum(["proposal.generate", "teams.confirm"]),
      data: z.object({
        competition_id: id,
        options: z.object({
          teamCount: z.number().int().min(2).max(24).optional(),
          playersPerTeam: z.number().int().min(7).max(15),
          substitutes: z.number().int().min(0).max(10),
          seed: z.number().int().min(0).max(1000000),
        }),
      }),
    }),
    z.object({
      type: z.literal("team.update"),
      data: z.object({
        id,
        name: z.string().trim().min(2).max(60),
        color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
      }),
    }),
    z.object({
      type: z.literal("member.move"),
      data: z.object({
        registration_id: id,
        team_id: z.union([id, z.literal("")]),
        captain: z.boolean(),
        substitute: z.boolean(),
        locked: z.boolean(),
        override_lock: z.boolean(),
        impact_confirmed: z.boolean(),
      }),
    }),
    z.object({
      type: z.enum(["teams.publish", "tournament.publish", "classify"]),
      data: z.object({ competition_id: id }),
    }),
    z.object({
      type: z.literal("tournament.generate"),
      data: z.object({ competition_id: id, settings: settingsSchema }),
    }),
    z.object({
      type: z.literal("match.result"),
      data: z.object({
        id: z.string().min(1).max(200),
        home_score: z.number().int().min(0).max(999),
        away_score: z.number().int().min(0).max(999),
        winner_id: z.union([id, z.literal("")]),
        correct_dependents: z.boolean(),
      }),
    }),
    z.object({
      type: z.literal("match.update"),
      data: z.object({
        id: z.string().min(1).max(200),
        starts_at: z.string().datetime({ offset: true }),
        court: z.number().int().min(1).max(8),
        status: z.enum(["scheduled", "live"]),
      }),
    }),
    z.object({
      type: z.literal("category.update"),
      data: z.object({
        id,
        min_age: z.number().int().min(13).max(90),
        max_age: z.number().int().min(13).max(90),
      }),
    }),
  ]),
});
export type AdminCommand = z.infer<typeof commandSchema>["command"];
