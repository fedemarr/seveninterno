import pg from "pg";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
if (process.stdin.isTTY) process.stdin.setRawMode(true);
console.log("Ready for on-site database test connection on hidden stdin.");
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
const check = (v, m) => {
  assert.ok(v, m);
  checks++;
};
try {
  await db.connect();
  await db.query("begin");
  const e = (
    await db.query("select * from public.events where active for update")
  ).rows[0];
  const actor = (
    await db.query(
      "select id from auth.users where email='fede@administradorlc.com'",
    )
  ).rows[0].id;
  const comp = (
    await db.query(
      "select * from public.competitions where event_id=$1 and name='Seven Interno'",
      [e.id],
    )
  ).rows[0];
  const team = (
    await db.query(
      "select id from public.teams where competition_id=$1 limit 1",
      [comp.id],
    )
  ).rows[0].id;
  const cat = (
    await db.query("select id from public.categories where name='PADRENCES'")
  ).rows[0].id;
  const position = (
    await db.query("select id from public.positions where name='Wing'")
  ).rows[0].id;
  let version = e.version;
  const firstId = randomUUID(),
    secondId = randomUUID();
  const input = {
    first_name: "TEST ONSITE ROLLBACK",
    last_name: randomUUID(),
    age: 25,
    category_id: cat,
    position_id: position,
    phone: "0000099991",
    consent: true,
    public_consent: false,
    website: "",
  };
  const apply = async (data) => {
    await db.query("select public.admin_apply($1)", [
      { type: "player.onsite.create", data, version, actor_id: actor },
    ]);
    version++;
  };
  await apply({
    input,
    registration_id: firstId,
    competition_id: comp.id,
    payment_confirmed: true,
    level: "A",
    team_id: team,
  });
  check(
    (
      await db.query(
        "select payment_status from public.registrations where id=$1",
        [firstId],
      )
    ).rows[0].payment_status === "PAGO_CONFIRMADO",
    "Paid on-site registration persists",
  );
  check(
    (
      await db.query(
        "select level from public.player_evaluations where registration_id=$1",
        [firstId],
      )
    ).rows[0].level === "A",
    "Level persists",
  );
  check(
    (
      await db.query(
        "select team_id,locked from public.team_members where registration_id=$1",
        [firstId],
      )
    ).rows[0].locked,
    "Chosen team is fixed against auto balancing",
  );
  check(
    (
      await db.query(
        "select count(*)::int n from public.payment_records where registration_id=$1",
        [firstId],
      )
    ).rows[0].n === 1,
    "Payment record is audited",
  );
  await apply({
    input: { ...input, last_name: randomUUID(), phone: "0000099992" },
    registration_id: secondId,
    competition_id: comp.id,
    payment_confirmed: false,
    level: "",
    team_id: "",
  });
  check(
    (
      await db.query(
        "select payment_status from public.registrations where id=$1",
        [secondId],
      )
    ).rows[0].payment_status === "PENDIENTE_PAGO",
    "Unpaid on-site registration remains pending",
  );
  check(
    (
      await db.query(
        "select count(*)::int n from public.team_members where registration_id=$1",
        [secondId],
      )
    ).rows[0].n === 0,
    "Unpaid participant has no team",
  );
  const invalidId = randomUUID();
  await db.query("savepoint invalid");
  try {
    await apply({
      input: { ...input, last_name: randomUUID(), phone: "0000099993" },
      registration_id: invalidId,
      competition_id: comp.id,
      payment_confirmed: false,
      level: "B",
      team_id: team,
    });
    throw Error("Expected payment rejection");
  } catch (error) {
    assert.match(error.message, /PAYMENT_REQUIRED/);
    checks++;
    await db.query("rollback to savepoint invalid");
  }
  check(
    (
      await db.query(
        "select count(*)::int n from public.registrations where id=$1",
        [invalidId],
      )
    ).rows[0].n === 0,
    "Invalid target rolls back entire registration",
  );
  await db.query("rollback");
  console.log(
    `PASS: ${checks} on-site registration checks. All changes rolled back.`,
  );
} catch (error) {
  await db.query("rollback").catch(() => {});
  console.error(
    "On-site database test failed:",
    error.message?.replaceAll(config.password, "[redacted]"),
  );
  process.exitCode = 1;
} finally {
  await db.end();
}
