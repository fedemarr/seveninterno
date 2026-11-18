import pg from "pg";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

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
  const event = (
    await db.query("select * from public.events where active for update")
  ).rows[0];
  assert.ok(event);
  const registrations = (
    await db.query(
      "select r.*,p.first_name,p.last_name,p.phone from public.registrations r join public.players p on p.id=r.player_id where r.event_id=$1",
      [event.id],
    )
  ).rows;
  const demo = registrations.filter(
    (r) => r.first_name.startsWith("PRUEBA ") && /^0\d+$/.test(r.phone),
  );
  const matches = (
    await db.query("select * from public.matches where event_id=$1", [event.id])
  ).rows;
  const teams = (
    await db.query("select * from public.teams where event_id=$1", [event.id])
  ).rows;
  console.log(
    JSON.stringify({
      event,
      registrations: registrations.length,
      demo: demo.length,
      otherNames: registrations
        .filter((r) => !demo.includes(r))
        .map((r) => ({ first_name: r.first_name, last_name: r.last_name })),
      teams: teams.length,
      matches: matches.length,
      published:
        teams.some((t) => t.published) || matches.some((m) => m.published),
      competitions: (
        await db.query("select * from public.competitions where event_id=$1", [
          event.id,
        ])
      ).rows,
    }),
  );
  if (process.argv.includes("--clean")) {
    assert.ok(!teams.some((t) => t.published));
    assert.ok(
      matches.every(
        (m) =>
          !m.published &&
          m.status === "scheduled" &&
          m.home_score === null &&
          m.away_score === null,
      ),
    );
    const ids = demo.map((r) => r.id);
    const members = (
      await db.query(
        "select tm.* from public.team_members tm join public.teams t on t.id=tm.team_id where t.event_id=$1",
        [event.id],
      )
    ).rows;
    assert.ok(
      members.every((m) => ids.includes(m.registration_id)),
      "A real player has a team: preserve the fixture and review first",
    );
    const tables = [
      "players",
      "registrations",
      "player_evaluations",
      "payment_records",
      "teams",
      "team_members",
      "matches",
      "tournament_plans",
      "team_generation_runs",
      "audit_logs",
      "events",
      "competitions",
    ];
    const backup = {};
    for (const table of tables)
      backup[table] = (await db.query(`select * from public.${table}`)).rows;
    await mkdir("backups", { recursive: true });
    const filename = `backups/before-live-${Date.now()}.json`;
    await writeFile(filename, JSON.stringify(backup), { flag: "wx" });
    await db.query("delete from public.matches where event_id=$1", [event.id]);
    await db.query("delete from public.tournament_plans where event_id=$1", [
      event.id,
    ]);
    await db.query(
      "delete from public.team_generation_runs where event_id=$1",
      [event.id],
    );
    await db.query(
      "delete from public.team_members where team_id=any($1::uuid[])",
      [teams.map((t) => t.id)],
    );
    await db.query("delete from public.teams where event_id=$1", [event.id]);
    await db.query(
      "delete from public.payment_records where registration_id=any($1::uuid[])",
      [ids],
    );
    await db.query(
      "delete from public.player_evaluations where registration_id=any($1::uuid[])",
      [ids],
    );
    await db.query(
      "delete from public.registrations where id=any($1::uuid[])",
      [ids],
    );
    await db.query(
      "delete from public.players p where id=any($1::uuid[]) and not exists(select 1 from public.registrations r where r.player_id=p.id)",
      [demo.map((r) => r.player_id)],
    );
    await db.query(
      "update public.events set state='BORRADOR',registration_open=false,late_registration=false,version=version+1 where id=$1",
      [event.id],
    );
    await db.query(
      "insert into public.audit_logs(event_id,action,before_data,after_data) values($1,'operations.remove_demo',$2,$3)",
      [
        event.id,
        { demo: demo.length, teams: teams.length, matches: matches.length },
        { preserved_real_registrations: registrations.length - demo.length },
      ],
    );
    await db.query("commit");
    console.log(
      JSON.stringify({
        cleaned: true,
        removedDemo: demo.length,
        preservedReal: registrations.length - demo.length,
        backup: filename,
      }),
    );
  } else if (process.argv.includes("--open")) {
    assert.equal(demo.length, 0, "Remove demo participants before opening");
    assert.equal(teams.length, 0, "Review existing teams before launch");
    assert.equal(matches.length, 0, "Remove the demo fixture before launch");
    const actor = (
      await db.query(
        "select id from auth.users where email='fede@administradorlc.com'",
      )
    ).rows[0].id;
    const categories = (
      await db.query("select name,registration_fee from public.categories")
    ).rows;
    assert.equal(categories.length, 8);
    for (const c of categories)
      assert.equal(
        Number(c.registration_fee),
        c.name === "M14"
          ? 12000
          : ["M15", "M16", "M17"].includes(c.name)
            ? 15000
            : 20000,
      );
    await db.query("select public.admin_apply($1)", [
      {
        type: "event.update",
        version: event.version,
        actor_id: actor,
        data: {
          ...event,
          state: "INSCRIPCIONES_ABIERTAS",
          registration_open: true,
          late_registration: false,
          amount: 20000,
          event_date: "2026-12-12",
        },
      },
    ]);
    await db.query("commit");
    console.log(
      JSON.stringify({
        opened: true,
        eventDate: "2026-12-12",
        prices: categories,
      }),
    );
  } else await db.query("rollback");
} catch (error) {
  await db.query("rollback").catch(() => {});
  console.error(error.message?.replaceAll(config.password, "[redacted]"));
  process.exitCode = 1;
} finally {
  await db.end();
}
