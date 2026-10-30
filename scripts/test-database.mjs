import pg from "pg";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
if (process.stdin.isTTY) process.stdin.setRawMode(true);
console.log("Ready for database test connection on hidden stdin.");
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
let assertions = 0;
const check = (value, message) => {
  assert.ok(value, message);
  assertions++;
};
async function expectedFailure(sql, params, pattern) {
  await db.query("savepoint expected_failure");
  try {
    await db.query(sql, params);
    throw new Error("Expected rejection did not occur: " + sql);
  } catch (e) {
    assert.match(e.message, pattern);
    assertions++;
    await db.query("rollback to savepoint expected_failure");
  }
  await db.query("release savepoint expected_failure");
}
try {
  await db.connect();
  await db.query("begin");
  const e = (await db.query("select * from public.events where active"))
    .rows[0];
  const actor = (
    await db.query(
      "select id from auth.users where email='fede@administradorlc.com'",
    )
  ).rows[0].id;
  const cat = (
    await db.query(
      "select id from public.categories where name='Plantel Superior'",
    )
  ).rows[0].id;
  const minorCat = (
    await db.query("select id from public.categories where name='M16'")
  ).rows[0].id;
  const position = (
    await db.query("select id from public.positions where name='Wing'")
  ).rows[0].id;
  const input = {
    first_name: "TestRollback",
    last_name: randomUUID(),
    age: 24,
    category_id: cat,
    position_id: position,
    phone: "1199998877",
    consent: true,
    public_consent: true,
    website: "",
  };
  await expectedFailure(
    "select public.register_player($1,$2)",
    [input, "database-test"],
    /REGISTRATION_CLOSED/,
  );
  await db.query(
    "update public.events set state='INSCRIPCIONES_ABIERTAS',registration_open=true,amount=1000,alias='test.rollback',holder='Test' where id=$1",
    [e.id],
  );
  const register = async (payload) =>
    (
      await db.query("select public.register_player($1,$2) as value", [
        payload,
        "database-test",
      ])
    ).rows[0].value;
  const registration = await register(input);
  check(Boolean(registration.id), "Persists registration");
  const duplicate = await register(input);
  check(duplicate.error === "DUPLICATE", "Rejects duplicate");
  const stored = (
    await db.query("select * from public.registrations where id=$1", [
      registration.id,
    ])
  ).rows[0];
  check(stored.payment_status === "PENDIENTE_PAGO", "Starts unpaid");
  await expectedFailure(
    "select public.register_player($1,$2)",
    [
      { ...input, last_name: "MinorMissing", age: 16, category_id: minorCat },
      "minor-test",
    ],
    /check constraint/,
  );
  await expectedFailure(
    "select public.register_player($1,$2)",
    [{ ...input, last_name: "WrongCategory", age: 16 }, "minor-test"],
    /CATEGORY_AGE/,
  );
  const minor = await register({
    ...input,
    last_name: "MinorPrivate",
    age: 16,
    category_id: minorCat,
    guardian_name: "PrivateGuardian",
    guardian_phone: "1199988877",
    guardian_consent: true,
  });
  check(Boolean(minor.id), "Registers authorized minor");
  let version = (
    await db.query("select version from public.events where id=$1", [e.id])
  ).rows[0].version;
  const apply = async (type, data) => {
    const r = await db.query("select public.admin_apply($1) as value", [
      { type, data, version, actor_id: actor },
    ]);
    version++;
    return r.rows[0].value;
  };
  await apply("payment.update", {
    id: registration.id,
    status: "PAGO_CONFIRMADO",
  });
  check(
    (
      await db.query(
        "select payment_status from public.registrations where id=$1",
        [registration.id],
      )
    ).rows[0].payment_status === "PAGO_CONFIRMADO",
    "Confirms payment",
  );
  check(
    (
      await db.query(
        "select count(*)::int n from public.payment_records where registration_id=$1",
        [registration.id],
      )
    ).rows[0].n === 1,
    "Audits payment",
  );
  await expectedFailure(
    "select public.admin_apply($1)",
    [
      {
        type: "payment.update",
        data: { id: registration.id, status: "PAGO_RECHAZADO" },
        version: version - 1,
        actor_id: actor,
      },
    ],
    /STALE_VERSION/,
  );
  await apply("player.update", {
    id: registration.id,
    active: true,
    level: "A",
    notes: "PrivateEvaluation",
    secondary_positions: ["Apertura"],
    available: true,
    assignment_locked: false,
    excluded: false,
    together_with: [],
    separate_from: [],
  });
  await apply("player.details", {
    id: registration.id,
    input: { ...input, first_name: "TestRollbackEdited" },
  });
  check(
    (
      await db.query("select first_name from public.players where id=$1", [
        stored.player_id,
      ])
    ).rows[0].first_name === "TestRollbackEdited",
    "Edits personal data",
  );
  check(
    (
      await db.query(
        "select level from public.player_evaluations where registration_id=$1",
        [registration.id],
      )
    ).rows[0].level === "A",
    "Personal edit preserves private evaluation",
  );
  const finances = (await db.query("select public.admin_snapshot() as value"))
    .rows[0].value;
  check(
    Number(finances.payment_total) === 1000,
    "Revenue uses recorded payment amount",
  );
  await apply("competition.create", {
    name: "Rollback Adults",
    category_ids: [cat],
    min_age: 18,
    max_age: 90,
    allow_mixed_ages: false,
    authorization_note: "",
  });
  const competition = (
    await db.query(
      "select id from public.competitions where name='Rollback Adults' and event_id=$1",
      [e.id],
    )
  ).rows[0].id;
  await apply("teams.confirm", {
    competition_id: competition,
    teams: [{ name: "Rollback Team", playerIds: [registration.id] }],
  });
  const team = (
    await db.query("select id from public.teams where competition_id=$1", [
      competition,
    ])
  ).rows[0].id;
  await apply("teams.publish", { competition_id: competition });
  await apply("team.update", {
    id: team,
    name: "Renamed Rollback Team",
    color: "#2566E8",
  });
  check(
    (
      await db.query(
        "select team_id from public.team_members where registration_id=$1",
        [registration.id],
      )
    ).rows[0].team_id === team,
    "Renaming preserves stable team ID",
  );
  const second = await register({ ...input, last_name: "SecondRollback" });
  version = (
    await db.query("select version from public.events where id=$1", [e.id])
  ).rows[0].version;
  check(
    (
      await db.query(
        "select team_id from public.team_members where registration_id=$1",
        [registration.id],
      )
    ).rows[0].team_id === team,
    "Late registration never reorganizes existing roster",
  );
  await apply("payment.update", { id: second.id, status: "PAGO_CONFIRMADO" });
  const secondTeam = (
    await db.query(
      "insert into public.teams(event_id,competition_id,name) values($1,$2,'Rollback Two') returning id",
      [e.id, competition],
    )
  ).rows[0].id;
  await apply("member.move", {
    registration_id: second.id,
    team_id: secondTeam,
    captain: false,
    substitute: true,
    locked: false,
  });
  await apply("member.swap", {
    first_id: registration.id,
    second_id: second.id,
    override_lock: false,
    impact_confirmed: true,
  });
  check(
    (
      await db.query(
        "select team_id from public.team_members where registration_id=$1",
        [registration.id],
      )
    ).rows[0].team_id === secondTeam,
    "Atomic swap moves first participant",
  );
  check(
    (
      await db.query(
        "select team_id from public.team_members where registration_id=$1",
        [second.id],
      )
    ).rows[0].team_id === team,
    "Atomic swap moves second participant",
  );
  await apply("member.swap", {
    first_id: registration.id,
    second_id: second.id,
    override_lock: false,
    impact_confirmed: true,
  });
  await db.query(
    "insert into public.matches(id,event_id,competition_id,number,phase,group_name,round,home_id,away_id,starts_at,court,duration) values('rollback-match',$1,$2,1,'group','A',1,$3,$4,now(),1,14)",
    [e.id, competition, team, secondTeam],
  );
  await apply("results.apply", {
    matches: [
      {
        id: "rollback-match",
        home_id: team,
        away_id: secondTeam,
        home_score: 21,
        away_score: 7,
        winner_id: team,
        status: "finished",
      },
    ],
  });
  await apply("team.update", {
    id: team,
    name: "Renamed After Result",
    color: "#2566E8",
  });
  const historic = (
    await db.query("select * from public.matches where id='rollback-match'")
  ).rows[0];
  check(
    historic.home_id === team &&
      historic.home_score === 21 &&
      historic.winner_id === team,
    "Rename preserves historical result and team references",
  );
  await expectedFailure(
    "select public.admin_apply($1)",
    [
      {
        type: "payment.update",
        data: { id: registration.id, status: "PAGO_RECHAZADO" },
        version,
        actor_id: actor,
      },
    ],
    /REMOVE_FROM_TEAM_FIRST/,
  );
  await expectedFailure(
    "select public.admin_apply($1)",
    [
      {
        type: "member.move",
        data: { registration_id: minor.id, team_id: team },
        version,
        actor_id: actor,
      },
    ],
    /INELIGIBLE_PLAYER/,
  );
  await db.query("set local role anon");
  const pub = (await db.query("select public.public_snapshot() as value"))
    .rows[0].value;
  const json = JSON.stringify(pub);
  check(
    !json.includes("PrivateGuardian") &&
      !json.includes("PrivateEvaluation") &&
      !json.includes("1199998877"),
    "Public snapshot has no private data",
  );
  check(!json.includes("MinorPrivate"), "No public names of minors");
  check(
    pub.members.some((m) => m.name.startsWith("TestRollback")),
    "Authorized adult name is projected",
  );
  await expectedFailure(
    "select * from public.players",
    [],
    /permission denied/,
  );
  await expectedFailure(
    "select public.admin_apply($1)",
    [{}],
    /permission denied/,
  );
  await expectedFailure(
    "select public.admin_snapshot()",
    [],
    /permission denied/,
  );
  await db.query("reset role");
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
    randomUUID(),
  ]);
  check(
    (await db.query("select * from public.registrations")).rowCount === 0,
    "RLS isolates non-admin authenticated user",
  );
  await expectedFailure(
    "select public.admin_apply($1)",
    [{}],
    /permission denied/,
  );
  await expectedFailure(
    "update public.registrations set payment_status='PAGO_CONFIRMADO'",
    [],
    /permission denied/,
  );
  await db.query("reset role");
  check(
    (
      await db.query(
        "select count(*)::int n from public.audit_logs where event_id=$1",
        [e.id],
      )
    ).rows[0].n >= 6,
    "Critical writes are audited",
  );
  await db.query(
    "update public.events set state='TORNEO_FINALIZADO' where id=$1",
    [e.id],
  );
  await apply("event.create", {
    name: "SEVEN INTERNO",
    edition: "Rollback next edition",
  });
  const nextEvent = (
    await db.query("select id from public.events where active")
  ).rows[0].id;
  check(nextEvent !== e.id, "Creates next edition with a stable new ID");
  check(
    (
      await db.query(
        "select count(*)::int n from public.registrations where event_id=$1",
        [e.id],
      )
    ).rows[0].n === 3,
    "Preserves previous edition registrations",
  );
  await db.query("rollback");
  console.log(
    `PASS: ${assertions} database assertions. All test changes rolled back.`,
  );
} catch (e) {
  await db.query("rollback").catch(() => {});
  console.error(
    "Database verification failed:",
    e.code ?? "",
    e.message?.replaceAll(config.password, "[redacted]"),
  );
  process.exitCode = 1;
} finally {
  await db.end();
}
