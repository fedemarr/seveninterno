import pg from "pg";
import assert from "node:assert/strict";

if (process.stdin.isTTY) process.stdin.setRawMode(true);
console.log("Ready for live preparation connection on hidden stdin.");
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
const base = "https://seveninterno.vercel.app";
const created = [];
let actor;
const teamIds = [];
try {
  await db.connect();
  actor = (
    await db.query("select id from auth.users where email=$1", [
      config.admin_email,
    ])
  ).rows[0].id;
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    actor,
  ]);
  const snapshot = async () =>
    (await db.query("select public.admin_snapshot() value")).rows[0].value;
  const initial = await snapshot();
  assert.equal(initial.event.registration_open, true);
  assert.equal(initial.event.event_date, "2026-12-12");
  const request = async (path, body, cookie = "") => {
    const response = await fetch(base + path, {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json", cookie },
      body: JSON.stringify(body),
    });
    return { response, json: await response.json() };
  };
  const login = await request("/api/auth", {
    email: config.admin_email,
    password: config.admin_password,
  });
  assert.equal(login.response.status, 200);
  const cookie = login.response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const stamp = Date.now().toString();
  for (const [i, name] of ["M14", "M16", "Plantel Superior"].entries()) {
    const c = initial.categories.find((c) => c.name === name);
    const input = {
      first_name: "PRUEBA LANZAMIENTO",
      last_name: stamp + String(i),
      age: c.min_age,
      category_id: c.id,
      position_id: initial.positions[0].id,
      secondary_position: initial.positions[1].name,
      phone: "0000099" + String(i).padStart(3, "0"),
      consent: true,
      public_consent: false,
      guardian_name: "RESPONSABLE DE PRUEBA",
      guardian_phone: "0000099999",
      guardian_consent: true,
      website: "",
    };
    const registered = await request("/api/inscripcion", input);
    assert.equal(
      registered.response.status,
      201,
      JSON.stringify(registered.json),
    );
    created.push(registered.json.data.id);
    assert.equal(
      Number(registered.json.data.amount),
      Number(c.registration_fee),
    );
    assert.equal(registered.json.data.alias, "fran.spaventa");
    const duplicate = await request("/api/inscripcion", input);
    assert.equal(duplicate.response.status, 400);
    assert.match(duplicate.json.error, /Ya recibimos/);
    for (const command of [
      {
        type: "player.evaluate",
        data: { id: created.at(-1), level: ["A", "B", "C"][i] },
      },
      {
        type: "payment.update",
        data: { id: created.at(-1), status: "PAGO_CONFIRMADO" },
      },
    ]) {
      const state = await snapshot();
      const result = await request(
        "/api/admin",
        { version: state.event.version, command },
        cookie,
      );
      assert.equal(result.response.status, 200, JSON.stringify(result.json));
    }
    const payment = (
      await db.query(
        "select amount from public.payment_records where registration_id=$1 order by created_at desc limit 1",
        [created.at(-1)],
      )
    ).rows[0];
    assert.equal(Number(payment.amount), Number(c.registration_fee));
  }
  const state = await snapshot();
  for (const id of created)
    assert.ok(
      state.registrations
        .find((r) => r.id === id)
        .secondary_positions.includes(initial.positions[1].name),
      "Secondary position preserved after grading and payment",
    );
  for (const id of created)
    assert.ok(
      state.members.some((m) => m.registration_id === id),
      "Confirmed player automatically assigned",
    );
  teamIds.push(
    ...state.teams
      .filter((t) => !initial.teams.some((old) => old.id === t.id))
      .map((t) => t.id),
  );
  const html = await (await fetch(base + "/inscripcion")).text();
  assert.ok(html.includes("Vetecedros"));
  assert.ok(!html.includes("todavía no están abiertas"));
  console.log(
    "PASS: production signup, all three price bands, minor authorization, duplicate rejection, administrator grading, payment accounting and automatic team assignment.",
  );
} catch (error) {
  console.error(
    error.message
      ?.replaceAll(config.password, "[redacted]")
      .replaceAll(config.admin_password, "[redacted]"),
  );
  process.exitCode = 1;
} finally {
  try {
    if (created.length) {
      await db.query("begin");
      await db.query("select id from public.events where active for update");
      const players = (
        await db.query(
          "select player_id from public.registrations where id=any($1::uuid[])",
          [created],
        )
      ).rows.map((r) => r.player_id);
      const associated = (
        await db.query(
          "select distinct team_id from public.team_members where registration_id=any($1::uuid[])",
          [created],
        )
      ).rows.map((r) => r.team_id);
      await db.query(
        "delete from public.team_members where registration_id=any($1::uuid[])",
        [created],
      );
      await db.query(
        "delete from public.teams t where id=any($1::uuid[]) and not published and not exists(select 1 from public.team_members m where m.team_id=t.id) and not exists(select 1 from public.matches m where m.home_id=t.id or m.away_id=t.id)",
        [[...teamIds, ...associated]],
      );
      await db.query(
        "delete from public.payment_records where registration_id=any($1::uuid[])",
        [created],
      );
      await db.query(
        "delete from public.player_evaluations where registration_id=any($1::uuid[])",
        [created],
      );
      await db.query(
        "delete from public.registrations where id=any($1::uuid[])",
        [created],
      );
      await db.query(
        "delete from public.players p where id=any($1::uuid[]) and not exists(select 1 from public.registrations r where r.player_id=p.id)",
        [players],
      );
      await db.query("update public.events set version=version+1 where active");
      await db.query(
        "insert into public.audit_logs(event_id,actor_id,action,after_data) select id,$1,'operations.live_smoke_cleanup',$2 from public.events where active",
        [actor, { registrations: created.length }],
      );
      await db.query("commit");
    }
    console.log(
      "Removed only the smoke test participants and their empty teams.",
    );
  } catch (error) {
    await db.query("rollback").catch(() => {});
    console.error("Smoke cleanup failed:", error.message);
    process.exitCode = 1;
  }
  await db.end();
}
