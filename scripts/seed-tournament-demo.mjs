// Populate this event with enough clearly labelled, fictitious players to test
// twelve teams. Credentials arrive only through hidden stdin; no password file.
import pg from "pg";
import assert from "node:assert/strict";
if (process.stdin.isTTY) process.stdin.setRawMode(true);
console.log("Ready for demo seed database connection on hidden stdin.");
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
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.matches where event_id=$1",
        [event.id],
      )
    ).rows[0].n,
    0,
    "Seed only before a fixture has been prepared",
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.teams where event_id=$1 and published",
        [event.id],
      )
    ).rows[0].n,
    0,
    "Do not reorganize published teams",
  );
  const actor = (
    await db.query(
      "select id from auth.users where email='fede@administradorlc.com'",
    )
  ).rows[0].id;
  let version = event.version;
  const categories = (await db.query("select * from public.categories")).rows,
    positions = (await db.query("select * from public.positions")).rows;
  const competition = (
    await db.query(
      "select * from public.competitions where event_id=$1 and name='Seven Interno'",
      [event.id],
    )
  ).rows[0];
  assert.ok(competition);
  async function apply(type, data) {
    await db.query("select public.admin_apply($1)", [
      { type, data, version, actor_id: actor },
    ]);
    version++;
  }
  const initial = (
    await db.query(
      "select r.*,p.first_name,p.last_name,p.phone,v.level,v.notes,coalesce(v.secondary_positions,'{}') secondary_positions,coalesce(v.available,true) available,coalesce(v.assignment_locked,false) assignment_locked,coalesce(v.excluded,false) excluded,coalesce(v.together_with,'{}') together_with,coalesce(v.separate_from,'{}') separate_from from public.registrations r join public.players p on p.id=r.player_id left join public.player_evaluations v on v.registration_id=r.id where r.event_id=$1",
      [event.id],
    )
  ).rows;
  for (const [i, p] of initial
    .filter(
      (p) =>
        p.first_name.startsWith("PRUEBA ") &&
        p.active &&
        p.available &&
        !p.excluded,
    )
    .entries()) {
    if (!p.level)
      await apply("player.update", {
        id: p.id,
        active: true,
        level: ["A", "B", "C"][i % 3],
        notes: p.notes ?? "Datos ficticios de prueba.",
        secondary_positions: p.secondary_positions,
        available: p.available,
        assignment_locked: p.assignment_locked,
        excluded: p.excluded,
        together_with: p.together_with,
        separate_from: p.separate_from,
      });
    if (p.payment_status !== "PAGO_CONFIRMADO")
      await apply("payment.update", { id: p.id, status: "PAGO_CONFIRMADO" });
  }
  const eligibleCount = async () =>
    (
      await db.query(
        "select count(*)::int n from public.registrations r left join public.player_evaluations v on v.registration_id=r.id where r.event_id=$1 and r.active and r.payment_status='PAGO_CONFIRMADO' and coalesce(v.available,true) and not coalesce(v.excluded,false) and r.category_id=any($2::uuid[]) and r.age between $3 and $4",
        [
          event.id,
          competition.category_ids,
          competition.min_age,
          competition.max_age,
        ],
      )
    ).rows[0].n;
  let eligible = await eligibleCount();
  assert.ok(eligible <= 144, "Do not remove existing participants to fit demo");
  const first = [
    "Mateo",
    "Tomas",
    "Santiago",
    "Bautista",
    "Ignacio",
    "Juan",
    "Agustin",
    "Franco",
    "Pedro",
    "Nicolas",
    "Lucas",
    "Martin",
    "Facundo",
    "Gonzalo",
    "Thiago",
    "Bruno",
    "Valentin",
    "Lautaro",
    "Ramiro",
    "Joaquin",
    "Matias",
    "Simon",
    "Felipe",
    "Marcos",
  ];
  const last = [
    "Rios",
    "Paz",
    "Vega",
    "Luna",
    "Soria",
    "Molina",
    "Acosta",
    "Diaz",
    "Romero",
    "Castro",
    "Medina",
    "Torres",
    "Silva",
    "Pereyra",
    "Alvarez",
    "Ortiz",
    "Benitez",
    "Suarez",
    "Navarro",
    "Herrera",
    "Carrizo",
    "Ibarra",
    "Costa",
    "Ruiz",
    "Peralta",
    "Leon",
    "Farias",
    "Blanco",
    "Aguirre",
    "Godoy",
    "Campos",
    "Vidal",
    "Arias",
    "Mendez",
    "Varela",
    "Ponce",
    "Ferreyra",
    "Cabrera",
    "Sosa",
    "Ramos",
  ];
  const names = [
      "Plantel Superior",
      "PADRENCES",
      "Veteranos",
      "M14",
      "M15",
      "M16",
      "M17",
      "M19",
    ],
    positionNames = [
      "Pilar izquierdo",
      "Hooker",
      "Tercera linea / Ala",
      "Medio scrum",
      "Apertura",
      "Wing",
      "Fullback",
    ];
  const plain = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let sequence = 41,
    added = 0;
  while (eligible < 144) {
    const i = sequence++,
      phone = String(1000 + i).padStart(10, "0");
    if (
      (await db.query("select 1 from public.players where phone=$1", [phone]))
        .rowCount
    )
      continue;
    const category = categories.find((c) => c.name === names[(i - 1) % 8]),
      position = positions.find(
        (p) => plain(p.name) === positionNames[(i - 1) % 7],
      );
    assert.ok(category && position);
    const age =
      category.name === "Veteranos"
        ? 35 + (i % 21)
        : category.name === "Plantel Superior"
          ? 18 + (i % 19)
          : category.name === "PADRENCES"
            ? 30 + (i % 18)
            : category.min_age +
              (i % (category.max_age - category.min_age + 1));
    await apply("player.create", {
      first_name: "PRUEBA " + first[(i - 1) % first.length],
      last_name:
        last[Math.floor((i - 1) / first.length) % last.length] +
        " " +
        last[(i - 1) % last.length],
      age,
      category_id: category.id,
      position_id: position.id,
      phone,
      consent: true,
      public_consent: false,
      guardian_name: age < 18 ? "RESPONSABLE DE PRUEBA" : undefined,
      guardian_phone: age < 18 ? String(2000 + i).padStart(10, "0") : undefined,
      guardian_consent: age < 18,
      website: "",
    });
    const reg = (
      await db.query(
        "select r.id from public.registrations r join public.players p on p.id=r.player_id where r.event_id=$1 and p.phone=$2",
        [event.id, phone],
      )
    ).rows[0];
    await apply("player.update", {
      id: reg.id,
      active: true,
      level: ["A", "B", "C"][(i - 1) % 3],
      notes:
        "DATOS FICTICIOS DE PRUEBA. Pago simulado para probar doce equipos y tres copas.",
      secondary_positions: [],
      available: true,
      assignment_locked: false,
      excluded: false,
      together_with: [],
      separate_from: [],
    });
    await apply("payment.update", { id: reg.id, status: "PAGO_CONFIRMADO" });
    eligible++;
    added++;
    if (added % 25 === 0)
      console.log(
        `Prepared ${eligible} confirmed test participants (transaction not committed yet).`,
      );
  }
  await apply("teams.automatic", {
    competition_id: competition.id,
    enabled: true,
    team_size: 12,
    capacity: 15,
  });
  assert.equal(await eligibleCount(), 144);
  await db.query("commit");
  console.log(
    JSON.stringify({
      confirmedPlayers: 144,
      added,
      teamSize: 12,
      expectedTeams: 12,
      playersClearlyMarkedAsTest: true,
    }),
  );
} catch (error) {
  await db.query("rollback").catch(() => {});
  console.error(
    "Demo seed failed:",
    error.message?.replaceAll(config.password, "[redacted]"),
  );
  process.exitCode = 1;
} finally {
  await db.end();
}
