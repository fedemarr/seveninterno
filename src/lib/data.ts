import "server-only";
import type {
  Category,
  Competition,
  EventConfig,
  Match,
  Member,
  Position,
  Registration,
  Team,
} from "./domain";
import { DEFAULT_EVENT, CATEGORIES, POSITIONS } from "./domain";
import type { FormatPlan } from "./engines/tournament";
import { configured, supabaseServer } from "./supabase/server";
export interface PublicSnapshot {
  event: EventConfig;
  categories: Category[];
  positions: Position[];
  teams: Team[];
  members: {
    team_id: string;
    name: string;
    captain: boolean;
    substitute: boolean;
  }[];
  matches: Match[];
  competitions: { id: string; name: string }[];
  plans: { competition_id: string; plan: FormatPlan }[];
  connected: boolean;
}
export interface AdminSnapshot extends Omit<
  PublicSnapshot,
  "members" | "competitions"
> {
  role: "owner" | "organizer" | "scorer";
  payment_total: number;
  registrations: Registration[];
  members: Member[];
  competitions: Competition[];
  proposals: {
    id: string;
    competition_id: string;
    proposal: unknown;
    created_at: string;
  }[];
  audit: {
    id: string;
    action: string;
    target_id: string;
    actor_id: string;
    created_at: string;
  }[];
}
export const fallback: PublicSnapshot = {
  event: {
    ...DEFAULT_EVENT,
    edition: "ANTONIO “TONY” LEYES · 10° ANIVERSARIO",
  },
  categories: CATEGORIES.map((name, i) => ({
    id: name,
    name,
    min_age: i === 2 ? 35 : i < 3 ? 18 : i === 7 ? 17 : 13 + i - 3,
    max_age: i < 3 ? 90 : i === 7 ? 19 : 14 + i - 3,
    minor: i >= 3 && i < 7,
  })),
  positions: POSITIONS.map((p) => ({ ...p, id: p.name })),
  teams: [],
  members: [],
  matches: [],
  competitions: [],
  plans: [],
  connected: false,
};
export async function getPublic(): Promise<PublicSnapshot> {
  if (!configured()) return fallback;
  try {
    const db = await supabaseServer();
    const { data, error } = await db.rpc("public_snapshot");
    if (error || !data?.event) return fallback;
    return { ...data, connected: true } as PublicSnapshot;
  } catch {
    return fallback;
  }
}
export async function requireAdmin() {
  const db = await supabaseServer();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new Error("UNAUTHORIZED");
  const { data: admin } = await db
    .from("admin_users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!admin) throw new Error("FORBIDDEN");
  return { db, user, role: admin.role as AdminSnapshot["role"] };
}
export async function getAdmin(): Promise<AdminSnapshot> {
  const { db } = await requireAdmin();
  const { data, error } = await db.rpc("admin_snapshot");
  if (error) throw new Error(error.message);
  return { ...data, connected: true } as AdminSnapshot;
}
