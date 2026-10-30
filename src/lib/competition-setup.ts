import type {
  Category,
  Competition,
  Member,
  Registration,
  Team,
} from "./domain";

export interface CompetitionPreset {
  name: string;
  category_ids: string[];
  min_age: number;
  max_age: number;
  allow_mixed_ages: boolean;
  authorization_note: string;
}

export const MIXED_SEVEN_AUTHORIZATION =
  "El organizador autoriza un unico Seven Interno con todas las categorias, desde M14 hasta Veteranos, con equipos equilibrados por nivel, posiciones y edades.";
/** This event is explicitly configured by its organizer as one mixed-age Seven. */
export function competitionPresets(
  categories: Category[],
): CompetitionPreset[] {
  if (!categories.length) return [];
  return [
    {
      name: "Seven Interno",
      category_ids: categories.map((c) => c.id),
      min_age: Math.min(...categories.map((c) => c.min_age)),
      max_age: Math.max(...categories.map((c) => c.max_age)),
      allow_mixed_ages: true,
      authorization_note: MIXED_SEVEN_AUTHORIZATION,
    },
  ];
}

export function eligibleForCompetition(
  player: Registration,
  competition: Pick<Competition, "id" | "category_ids" | "min_age" | "max_age">,
  teams: Team[],
  members: Member[],
) {
  return (
    player.active &&
    player.available &&
    !player.excluded &&
    player.payment_status === "PAGO_CONFIRMADO" &&
    competition.category_ids.includes(player.category_id) &&
    player.age >= competition.min_age &&
    player.age <= competition.max_age &&
    !members.some(
      (member) =>
        member.registration_id === player.id &&
        teams.find((team) => team.id === member.team_id)?.competition_id !==
          competition.id,
    )
  );
}
