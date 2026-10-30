export const CATEGORIES = [
  "Plantel Superior",
  "PADRENCES",
  "Veteranos",
  "M14",
  "M15",
  "M16",
  "M17",
  "M19",
] as const;
export const POSITIONS = [
  { name: "Pilar izquierdo", group: "forward" },
  { name: "Pilar derecho", group: "forward" },
  { name: "Hooker", group: "forward" },
  { name: "Segunda línea", group: "forward" },
  { name: "Tercera línea / Ala", group: "forward" },
  { name: "Octavo", group: "forward" },
  { name: "Medio scrum", group: "back" },
  { name: "Apertura", group: "back" },
  { name: "Primer centro", group: "back" },
  { name: "Segundo centro", group: "back" },
  { name: "Wing", group: "back" },
  { name: "Fullback", group: "back" },
] as const;
export const EVENT_STATES = [
  "BORRADOR",
  "INSCRIPCIONES_ABIERTAS",
  "PREPARACION_EQUIPOS",
  "EQUIPOS_PUBLICADOS",
  "TORNEO_CONFIGURADO",
  "TORNEO_EN_CURSO",
  "TORNEO_FINALIZADO",
] as const;
export type EventState = (typeof EVENT_STATES)[number];
export const PAYMENT_STATES = [
  "PENDIENTE_PAGO",
  "PAGO_EN_REVISION",
  "PAGO_CONFIRMADO",
  "PAGO_RECHAZADO",
] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];
export interface EventConfig {
  id: string;
  name: string;
  edition: string;
  state: EventState;
  registration_open: boolean;
  late_registration: boolean;
  amount: number;
  alias: string;
  holder: string;
  bank_account: string;
  payment_instructions: string;
  event_date: string | null;
  version: number;
}
export interface Category {
  id: string;
  name: string;
  min_age: number;
  max_age: number;
  minor: boolean;
}
export interface Position {
  id: string;
  name: string;
  group: "forward" | "back";
}
export interface Registration {
  guardian_consent: boolean;
  id: string;
  event_id: string;
  player_id: string;
  first_name: string;
  last_name: string;
  age: number;
  category_id: string;
  position_id: string;
  phone: string;
  guardian_name: string | null;
  guardian_phone: string | null;
  public_consent: boolean;
  payment_status: PaymentState;
  active: boolean;
  created_at: string;
  version: number;
  level: "A" | "B" | "C" | null;
  notes: string;
  secondary_positions: string[];
  available: boolean;
  assignment_locked: boolean;
  excluded: boolean;
  together_with: string[];
  separate_from: string[];
}
export interface Competition {
  id: string;
  event_id: string;
  name: string;
  category_ids: string[];
  min_age: number;
  max_age: number;
  allow_mixed_ages: boolean;
  authorization_note: string;
  version: number;
}
export interface Team {
  id: string;
  event_id: string;
  competition_id: string;
  name: string;
  color: string;
  published: boolean;
  version: number;
}
export interface Member {
  id: string;
  team_id: string;
  registration_id: string;
  captain: boolean;
  substitute: boolean;
  locked: boolean;
}
export interface Match {
  id: string;
  event_id: string;
  competition_id: string;
  number: number;
  phase: "group" | "gold" | "silver" | "milk";
  group_name: string | null;
  round: number;
  home_id: string | null;
  away_id: string | null;
  home_source: string | null;
  away_source: string | null;
  starts_at: string;
  court: number;
  duration: number;
  status: "scheduled" | "live" | "finished";
  home_score: number | null;
  away_score: number | null;
  winner_id: string | null;
  published: boolean;
  version: number;
}
export interface Standing {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  for: number;
  against: number;
  difference: number;
  points: number;
}
export interface TournamentSettings {
  courts: number;
  start: string;
  end: string;
  matchMinutes: number;
  restMinutes: number;
  minMatches: number;
  gold: boolean;
  silver: boolean;
  milk: boolean;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  tiebreakers: ("points" | "difference" | "for" | "won")[];
  crossGroup: "pointsPerGame" | "points";
}
export const DEFAULT_SETTINGS: TournamentSettings = {
  courts: 2,
  start: "2026-11-21T10:00:00-03:00",
  end: "2026-11-21T20:00:00-03:00",
  matchMinutes: 14,
  restMinutes: 14,
  minMatches: 3,
  gold: true,
  silver: true,
  milk: true,
  winPoints: 3,
  drawPoints: 1,
  lossPoints: 0,
  tiebreakers: ["points", "difference", "for", "won"],
  crossGroup: "pointsPerGame",
};
export const DEFAULT_EVENT: EventConfig = {
  id: "",
  name: "SEVEN INTERNO",
  edition: "Los Cedros Rugby Club",
  state: "BORRADOR",
  registration_open: false,
  late_registration: false,
  amount: 0,
  alias: "",
  holder: "",
  bank_account: "",
  payment_instructions:
    "Transferí y enviá tu comprobante por WhatsApp a Fede o Bauti. Tu participación queda pendiente hasta la confirmación.",
  event_date: null,
  version: 0,
};
