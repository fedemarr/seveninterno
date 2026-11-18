// Recompute unpublished squads through the production admin API, preserving players.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
if (process.stdin.isTTY) process.stdin.setRawMode(true);
console.log("Ready for admin login on hidden stdin.");
process.stdin.resume();
const credentials = await new Promise((resolve) => {
  let buffer = "";
  process.stdin.on("data", (chunk) => {
    buffer += chunk.toString();
    if (/[\r\n]/.test(buffer)) resolve(JSON.parse(buffer.trim()));
  });
});
if (process.stdin.isTTY) process.stdin.setRawMode(false);
process.stdin.pause();
const base = "https://seveninterno.vercel.app";
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
async function read(table, columns = "*") {
  const { data, error } = await db.from(table).select(columns);
  assert.equal(error, null);
  return data;
}
try {
  const before = await read("registrations", "id,payment_status,active");
  const grades = await read("player_evaluations", "registration_id,level");
  const event = (await read("events", "id,active,version")).find(
    (e) => e.active,
  );
  const competition = (await read("competitions")).find(
    (c) => c.event_id === event.id && c.name === "Seven Interno",
  );
  const teams = (await read("teams")).filter(
    (t) => t.competition_id === competition.id,
  );
  const matches = (await read("matches", "competition_id")).filter(
    (m) => m.competition_id === competition.id,
  );
  assert.ok(
    teams.every((t) => !t.published) && !matches.length,
    "Only rebalance drafts before a fixture exists",
  );
  const login = await fetch(base + "/api/auth", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const result = await fetch(base + "/api/admin", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json", cookie },
    body: JSON.stringify({
      version: event.version,
      command: {
        type: "teams.automatic",
        data: {
          competition_id: competition.id,
          enabled: true,
          team_size: competition.auto_team_size,
          capacity: competition.auto_team_capacity,
        },
      },
    }),
  });
  assert.equal(result.status, 200, await result.text());
  const sort = (rows, key) => rows.sort((a, b) => a[key].localeCompare(b[key]));
  assert.deepEqual(
    sort(await read("registrations", "id,payment_status,active"), "id"),
    sort(before, "id"),
  );
  assert.deepEqual(
    sort(
      await read("player_evaluations", "registration_id,level"),
      "registration_id",
    ),
    sort(grades, "registration_id"),
  );
  const updated = (await read("teams")).filter(
    (t) => t.competition_id === competition.id,
  );
  const members = await read("team_members", "team_id,registration_id");
  const ids = members
    .filter((m) => updated.some((t) => t.id === m.team_id))
    .map((m) => m.registration_id);
  assert.equal(new Set(ids).size, ids.length);
  console.log(
    JSON.stringify({
      playersAndPaymentsPreserved: true,
      teams: updated.map((t) => ({
        name: t.name,
        levels: members
          .filter((m) => m.team_id === t.id)
          .map(
            (m) =>
              grades.find((g) => g.registration_id === m.registration_id)
                ?.level,
          ),
      })),
    }),
  );
} catch (error) {
  console.error(error.message?.replaceAll(credentials.password, "[redacted]"));
  process.exitCode = 1;
}
