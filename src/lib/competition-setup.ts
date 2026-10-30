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
  allow_mixed_ages: false;
  authorization_note: string;
}

/** Quick setup always separates minors from adults, including the M19 boundary. */
export function competitionPresets(
  categories: Category[],
): CompetitionPreset[] {
  const result: CompetitionPreset[] = [];
  const adults = categories.filter((c) =>
    ["Plantel Superior", "PADRENCES", "Veteranos"].includes(c.name),
  );
  if (adults.length)
    result.push({
      name: "Adultos",
      category_ids: adults.map((c) => c.id),
      min_age: 18,
      max_age: 90,
      allow_mixed_ages: false,
      authorization_note: "",
    });
  for (const category of categories.filter((c) => !adults.includes(c))) {
    const min = Math.max(13, category.min_age),
      max = Math.min(90, category.max_age);
    if (min <= Math.min(17, max))
      result.push({
        name: max >= 18 ? `${category.name} · Menores` : category.name,
        category_ids: [category.id],
        min_age: min,
        max_age: Math.min(17, max),
        allow_mixed_ages: false,
        authorization_note: "",
      });
    if (Math.max(18, min) <= max)
      result.push({
        name: min < 18 ? `${category.name} · Mayores` : category.name,
        category_ids: [category.id],
        min_age: Math.max(18, min),
        max_age: max,
        allow_mixed_ages: false,
        authorization_note: "",
      });
  }
  return result;
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
