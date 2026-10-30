import pg from "pg";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
if (process.stdin.isTTY) process.stdin.setRawMode(true);
console.log(
  "Ready for automatic-team database test connection on hidden stdin.",
);
process.stdin.resume();
const config = await new Promise((resolve) => {
  let buffer = "";
  process.stdin.on("data", (chunk) => {
    buffer += chunk.toString();
    if (/[\r\n]/.test(buffer)) resolve(JSON.parse(buffer.trim()));
  });
});
if (process.stdin.isTTY) process.stdin.setRawMode(false);
process.stdin.pause();
const db = new pg.Client({
  ...config,
  database: "postgres",
  port: 5432,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});
let checks = 0;
const check = (value, message) => {
  assert.ok(value, message);
  checks++;
};
async function reject(command, pattern) {
  await db.query("savepoint rejected");
  try {
    await db.query("select public.admin_apply($1)", [command]);
    throw new Error("Expected rejection");
  } catch (e) {
    assert.match(e.message, pattern);
    checks++;
    await db.query("rollback to savepoint rejected");
  }
  await db.query("release savepoint rejected");
}
try {
  await db.connect();
  await db.query("begin");
  const actor = (
    await db.query(
      "select id from auth.users where email='fede@administradorlc.com'",
    )
  ).rows[0].id;
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
  const snapshot = async () =>
    (await db.query("select public.admin_snapshot() value")).rows[0].value;
  let state = await snapshot();
  const comp = state.competitions.find((c) => c.name === "Seven Interno");
  await db.query("delete from public.matches where competition_id=$1", [
    comp.id,
  ]);
  await db.query(
    "delete from public.tournament_plans where competition_id=$1",
    [comp.id],
  );
  await db.query(
    "update public.teams set published=false where competition_id=$1",
    [comp.id],
  );
  const category = state.categories.find((c) => c.name === "Plantel Superior"),
    position = state.positions.find((p) => p.name === "Wing");
  for (let i = 0; i < 2; i++) {
    state = await snapshot();
    await db.query("select public.admin_apply($1)", [
      {
        type: "player.create",
        version: state.event.version,
        actor_id: actor,
        data: {
          first_name: "PRUEBA AUTO ROLLBACK",
          last_name: randomUUID(),
          age: 25,
          category_id: category.id,
          position_id: position.id,
          phone: "000009991" + i,
          consent: true,
          public_consent: false,
          guardian_consent: false,
          website: "",
        },
      },
    ]);
  }
  state = await snapshot();
  const teams = state.teams.filter((t) => t.competition_id === comp.id);
  check(teams.length >= 2, "Existing test teams available");
  const plan = {
    competition_id: comp.id,
    mode: "rebalance",
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      is_new: false,
      members: state.members
        .filter((m) => m.team_id === t.id)
        .map((m) => ({
          registration_id: m.registration_id,
          captain: m.captain,
          substitute: m.substitute,
          locked: m.locked,
        })),
    })),
  };
  await db.query("select public.admin_apply($1)", [
    {
      type: "teams.automatic",
      data: {
        competition_id: comp.id,
        enabled: true,
        team_size: 10,
        capacity: 15,
      },
      version: state.event.version,
      actor_id: actor,
      automatic_teams: plan,
    },
  ]);
  const after = await snapshot();
  check(
    after.event.version === state.event.version + 1,
    "Configuration and roster update share one event version",
  );
  check(
    after.members.length === state.members.length,
    "No members duplicated or lost",
  );
  check(
    after.audit.some((a) => a.action === "teams.auto.updated"),
    "Automatic update is audited",
  );
  const pending = after.registrations.filter(
    (r) =>
      r.first_name.startsWith("PRUEBA ") &&
      r.payment_status === "PENDIENTE_PAGO",
  );
  check(pending.length >= 2, "Pending test players available");
  const first = teams[0];
  const append = {
    competition_id: comp.id,
    mode: "append",
    teams: [
      {
        id: first.id,
        name: first.name,
        is_new: false,
        members: [
          {
            registration_id: pending[0].id,
            captain: false,
            substitute: true,
            locked: false,
          },
        ],
      },
    ],
  };
  await db.query("select public.admin_apply($1)", [
    {
      type: "payment.update",
      data: { id: pending[0].id, status: "PAGO_CONFIRMADO" },
      version: after.event.version,
      actor_id: actor,
      automatic_teams: append,
    },
  ]);
  state = await snapshot();
  check(
    state.registrations.find((p) => p.id === pending[0].id).payment_status ===
      "PAGO_CONFIRMADO",
    "Payment persists with automatic assignment",
  );
  check(
    state.members.some(
      (m) => m.registration_id === pending[0].id && m.team_id === first.id,
    ),
    "Confirmation adds player in the same transaction",
  );
  const invalid = {
    ...append,
    teams: [
      {
        ...append.teams[0],
        members: [
          {
            registration_id: "00000000-0000-0000-0000-000000000000",
            captain: false,
            substitute: true,
            locked: false,
          },
        ],
      },
    ],
  };
  await reject(
    {
      type: "payment.update",
      data: { id: pending[1].id, status: "PAGO_CONFIRMADO" },
      version: state.event.version,
      actor_id: actor,
      automatic_teams: invalid,
    },
    /INELIGIBLE_PLAYER/,
  );
  const unchanged = await snapshot();
  check(
    unchanged.registrations.find((p) => p.id === pending[1].id)
      .payment_status === "PENDIENTE_PAGO",
    "Invalid assignment rolls back payment",
  );
  check(
    unchanged.event.version === state.event.version,
    "Rejected assignment preserves the event version",
  );
  await db.query("update public.teams set published=true where id=$1", [
    first.id,
  ]);
  await reject(
    {
      type: "teams.automatic",
      data: {
        competition_id: comp.id,
        enabled: true,
        team_size: 10,
        capacity: 15,
      },
      version: state.event.version,
      actor_id: actor,
      automatic_teams: plan,
    },
    /ROSTERS_FROZEN/,
  );
  await reject(
    {
      type: "teams.automatic",
      data: {
        competition_id: comp.id,
        enabled: true,
        team_size: 10,
        capacity: 15,
      },
      version: state.event.version - 1,
      actor_id: actor,
    },
    /STALE_VERSION/,
  );
  await db.query("rollback");
  console.log(
    `PASS: ${checks} automatic-team database assertions. All test changes rolled back.`,
  );
} catch (error) {
  await db.query("rollback").catch(() => {});
  console.error(
    "Automatic-team database test failed:",
    error.message?.replaceAll(config.password, "[redacted]"),
  );
  process.exitCode = 1;
} finally {
  await db.end();
}
