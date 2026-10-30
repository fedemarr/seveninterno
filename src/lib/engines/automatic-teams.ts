import type {
  Competition,
  Member,
  Position,
  Registration,
  Team,
  Match,
  EventConfig,
} from "../domain";
import { eligibleForCompetition } from "../competition-setup";
import {
  generateBalancedTeams,
  suggestLateTeam,
  type BalancePlayer,
} from "./balance";

export interface AutoTeamContext {
  registrations: Registration[];
  teams: Team[];
  members: Member[];
  positions: Position[];
  matches: Match[];
  event: Pick<EventConfig, "state">;
}
export interface AutomaticTeamPlan {
  competition_id: string;
  mode: "rebalance" | "append";
  teams: {
    id: string;
    name: string;
    is_new: boolean;
    members: {
      registration_id: string;
      captain: boolean;
      substitute: boolean;
      locked: boolean;
    }[];
  }[];
}
export function planAutomaticTeams(
  ctx: AutoTeamContext,
  competition: Competition,
  makeId: () => string,
): { plan: AutomaticTeamPlan | null; notice: string } {
  if (!competition.automatic_teams) return { plan: null, notice: "" };
  if (ctx.event.state === "TORNEO_FINALIZADO")
    return {
      plan: null,
      notice: "El torneo terminó. Las incorporaciones se revisan manualmente.",
    };
  const existing = ctx.teams
    .filter((t) => t.competition_id === competition.id)
    .sort((a, b) => a.id.localeCompare(b.id));
  const eligible = ctx.registrations.filter((p) =>
    eligibleForCompetition(p, competition, ctx.teams, ctx.members),
  );
  if (!eligible.length) return { plan: null, notice: "" };
  const capacity = competition.auto_team_capacity ?? 15;
  const asPlayer = (p: Registration): BalancePlayer => {
    const position = ctx.positions.find((pos) => pos.id === p.position_id);
    if (!position) throw new Error("Hay un jugador sin posición válida.");
    const member = ctx.members.find((m) => m.registration_id === p.id);
    return {
      id: p.id,
      age: p.age,
      level: p.level,
      position: position.name,
      group: position.group,
      secondaryPositions: p.secondary_positions,
      paid: true,
      eligible: true,
      available: true,
      together: p.together_with,
      separate: p.separate_from,
      lockedTeam:
        member && (member.locked || member.captain || p.assignment_locked)
          ? existing.findIndex((t) => t.id === member.team_id)
          : undefined,
    };
  };
  const frozen =
    existing.some((t) => t.published) ||
    ctx.matches.some((m) => m.competition_id === competition.id) ||
    ["TORNEO_CONFIGURADO", "TORNEO_EN_CURSO"].includes(ctx.event.state);
  if (frozen) {
    const rosters = existing.map((team) => ({
      id: team.id,
      name: team.name,
      is_new: false,
      members: ctx.members
        .filter((m) => m.team_id === team.id)
        .map((m) => ({
          registration_id: m.registration_id,
          captain: m.captain,
          substitute: m.substitute,
          locked: m.locked,
        })),
    }));
    const additions = existing.map((team) => ({
      id: team.id,
      name: team.name,
      is_new: false,
      members: [] as AutomaticTeamPlan["teams"][number]["members"],
    }));
    let waiting = 0;
    for (const player of eligible
      .filter((p) => !ctx.members.some((m) => m.registration_id === p.id))
      .sort((a, b) => a.id.localeCompare(b.id))) {
      const metrics = rosters.map((team, index) => {
        const players = team.members.map((m) =>
          ctx.registrations.find((p) => p.id === m.registration_id)!,
        );
        const forwards = players.filter(
          (p) =>
            ctx.positions.find((pos) => pos.id === p.position_id)?.group ===
            "forward",
        ).length;
        return {
          index,
          playerIds: players.map((p) => p.id),
          strength: players.reduce(
            (sum, p) => sum + (p.level === "A" ? 3 : p.level === "C" ? 1 : 2),
            0,
          ),
          forwards,
          backs: players.length - forwards,
        };
      });
      const choices = suggestLateTeam(
        asPlayer(player),
        metrics,
        capacity,
      ).filter(
        (choice) =>
          rosters[choice.teamIndex].members.every(
            (m) =>
              !ctx.registrations
                .find((p) => p.id === m.registration_id)
                ?.separate_from.includes(player.id),
          ) &&
          ctx.registrations
            .filter((p) => p.together_with.includes(player.id))
            .every((p) =>
              rosters[choice.teamIndex].members.some(
                (m) => m.registration_id === p.id,
              ),
            ),
      );
      if (!choices.length) {
        waiting++;
        continue;
      }
      const target = choices[0].teamIndex;
      const member = {
        registration_id: player.id,
        captain: false,
        substitute: rosters[target].members.length >= 7,
        locked: false,
      };
      rosters[target].members.push(member);
      additions[target].members.push(member);
    }
    const teams = additions.filter((t) => t.members.length);
    const count = teams.reduce((sum, t) => sum + t.members.length, 0);
    return {
      plan: count
        ? { competition_id: competition.id, mode: "append", teams }
        : null,
      notice: waiting
        ? `${waiting} jugador(es) esperan asignación: revisá capacidad y restricciones en Equipos.`
        : count
          ? `${count} jugador(es) se sumaron a los equipos existentes. Se conserva el fixture.`
          : "",
    };
  }
  const targetSize = competition.auto_team_size ?? 10;
  const desired = Math.max(
    1,
    Math.min(
      Math.max(1, Math.floor(eligible.length / 7)),
      Math.ceil(eligible.length / targetSize),
    ),
  );
  const count = Math.max(
    existing.length,
    desired,
    Math.ceil(eligible.length / capacity),
  );
  const rosterSize = Math.max(targetSize, Math.ceil(eligible.length / count));
  if (rosterSize > capacity)
    throw new Error(
      "Los equipos alcanzaron la capacidad máxima. Revisá los ajustes.",
    );
  const balanced = generateBalancedTeams(eligible.map(asPlayer), {
    teamCount: count,
    playersPerTeam: 7,
    substitutes: rosterSize - 7,
    seed: 1,
    allowIncomplete: true,
  });
  let nextNumber =
    Math.max(
      existing.length,
      ...existing.map((t) => Number(t.name.match(/^Equipo (\d+)$/)?.[1] ?? 0)),
    ) + 1;
  const teams = balanced.teams.map((team) => {
    const prior = existing[team.index];
    return {
      id: prior?.id ?? makeId(),
      name: prior?.name ?? `Equipo ${nextNumber++}`,
      is_new: !prior,
      members: team.playerIds.map((id, index) => {
        const member = ctx.members.find((m) => m.registration_id === id);
        return {
          registration_id: id,
          captain: member?.captain ?? false,
          substitute: index >= 7,
          locked: member?.locked ?? false,
        };
      }),
    };
  });
  return {
    plan: { competition_id: competition.id, mode: "rebalance", teams },
    notice: `Equipos actualizados automáticamente: ${eligible.length} jugadores en ${teams.length} equipo(s).`,
  };
}
