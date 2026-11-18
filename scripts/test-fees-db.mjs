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
  await db.query(
    "update public.events set state='INSCRIPCIONES_ABIERTAS',registration_open=true,amount=20000 where id=$1",
    [e.id],
  );
  const position = (await db.query("select id from public.positions limit 1"))
    .rows[0].id;
  const categories = (await db.query("select * from public.categories")).rows;
  let checks = 0;
  for (const [i, c] of categories.entries()) {
    const expected =
      c.name === "M14"
        ? 12000
        : ["M15", "M16", "M17"].includes(c.name)
          ? 15000
          : 20000;
    const input = {
      first_name: "TEST FEE ROLLBACK",
      last_name: c.name,
      age: c.min_age,
      category_id: c.id,
      position_id: position,
      phone: "000009" + String(i).padStart(4, "0"),
      consent: true,
      public_consent: false,
      guardian_name: "TEST GUARDIAN",
      guardian_phone: "0000099999",
      guardian_consent: true,
    };
    const r = (
      await db.query("select public.register_player($1,$2) value", [
        input,
        "fee-test-" + i,
      ])
    ).rows[0].value;
    assert.ok(r.id);
    assert.equal(Number(r.amount), expected);
    checks += 2;
    const duplicate = (
      await db.query("select public.register_player($1,$2) value", [
        input,
        "fee-test-" + i,
      ])
    ).rows[0].value;
    assert.equal(duplicate.error, "DUPLICATE");
    checks++;
    await db.query("update public.events set amount=1 where id=$1", [e.id]);
    const version = (
      await db.query("select version from public.events where id=$1", [e.id])
    ).rows[0].version;
    await db.query("select public.admin_apply($1)", [
      {
        type: "payment.update",
        version,
        actor_id: actor,
        data: { id: r.id, status: "PAGO_CONFIRMADO" },
      },
    ]);
    const payment = (
      await db.query(
        "select amount from public.payment_records where registration_id=$1",
        [r.id],
      )
    ).rows[0];
    assert.equal(Number(payment.amount), expected);
    checks++;
  }
  await db.query("rollback");
  console.log(
    "PASS: " +
      checks +
      " database fee checks; every category, duplicate rejection and frozen payment amounts. All tests rolled back.",
  );
} catch (error) {
  await db.query("rollback").catch(() => {});
  console.error(error.message?.replaceAll(config.password, "[redacted]"));
  process.exitCode = 1;
} finally {
  await db.end();
}
