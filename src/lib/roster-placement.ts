import type { Competition, Member, Registration, Team } from "./domain";
export interface PlacementContext {
  registrations: Registration[];
  competitions: Competition[];
  teams: Team[];
  members: Member[];
}
/** Shared validation for manual moves and a paid on-site registration. */
export function validateRosterPlacement(
  context: PlacementContext,
  player: Registration,
  team: Team,
) {
  const competition = context.competitions.find(
    (c) => c.id === team.competition_id,
  );
  if (
    !competition ||
    player.event_id !== team.event_id ||
    !player.active ||
    !player.available ||
    player.excluded ||
    player.payment_status !== "PAGO_CONFIRMADO" ||
    !competition.category_ids.includes(player.category_id) ||
    player.age < competition.min_age ||
    player.age > competition.max_age
  )
    throw new Error(
      "El jugador no está habilitado para este equipo. Revisá pago, categoría y disponibilidad.",
    );
  const members = context.members.filter(
    (m) => m.team_id === team.id && m.registration_id !== player.id,
  );
  if (members.length >= (competition.auto_team_capacity ?? 15))
    throw new Error(
      "El equipo alcanzó su capacidad máxima. Elegí otro equipo o revisá la capacidad en Ajustes.",
    );
  if (
    player.together_with.some(
      (id) => !members.some((m) => m.registration_id === id),
    ) ||
    context.registrations.some(
      (other) =>
        other.id !== player.id &&
        other.together_with.includes(player.id) &&
        !members.some((m) => m.registration_id === other.id),
    )
  )
    throw new Error(
      "El movimiento separaría jugadores que deben permanecer juntos.",
    );
  for (const member of members) {
    const other = context.registrations.find(
      (p) => p.id === member.registration_id,
    );
    if (
      player.separate_from.includes(member.registration_id) ||
      other?.separate_from.includes(player.id)
    )
      throw new Error("Estos jugadores tienen una restricción de separación.");
  }
}
