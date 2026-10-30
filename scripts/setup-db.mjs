import pg from "pg";
import { readFile, writeFile } from "node:fs/promises";
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdout.write("Ready for database configuration on stdin.\n");
process.stdin.resume();
const config = await new Promise((resolve) => {
  let buffer = "";
  process.stdin.on("data", (chunk) => {
    buffer += chunk.toString();
    if (buffer.includes("\n") || buffer.includes("\r"))
      resolve(JSON.parse(buffer.trim()));
  });
});
if (process.stdin.isTTY) process.stdin.setRawMode(false);
process.stdin.pause();
const client = new pg.Client({
  host: config.host,
  port: 5432,
  user: config.user,
  password: config.password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});
try {
  await client.connect();
  const existing = await client.query(
    "select to_regclass('public.events') as existing",
  );
  if (existing.rows[0].existing) {
    console.log(
      "Existing Seven database found; migration skipped to preserve data.",
    );
  } else {
    await client.query("begin");
    try {
      await client.query(
        await readFile("supabase/migrations/001_platform.sql", "utf8"),
      );
      await client.query("commit");
      console.log("Schema migration applied.");
    } catch (e) {
      await client.query("rollback");
      throw e;
    }
  }
  await client.query("begin");
  try {
    await client.query(
      await readFile("supabase/migrations/002_server_mutations.sql", "utf8"),
    );
    await client.query("commit");
    console.log("Server mutation permissions applied.");
  } catch (e) {
    await client.query("rollback");
    throw e;
  }
  await client.query(
    await readFile(
      "supabase/migrations/003_explicit_function_grants.sql",
      "utf8",
    ),
  );
  await client.query(
    await readFile("supabase/migrations/004_operations.sql", "utf8"),
  );
  await client.query(
    await readFile("supabase/migrations/005_padrences.sql", "utf8"),
  );
  await client.query(
    await readFile("supabase/migrations/006_competition_update.sql", "utf8"),
  );
  await client.query(
    await readFile("supabase/migrations/007_automatic_teams.sql", "utf8"),
  );
  const check = await client.query(
    "select (select count(*) from public.categories) as categories,(select count(*) from public.positions) as positions,(select count(*) from pg_tables where schemaname='public' and rowsecurity) as protected_tables",
  );
  console.log(JSON.stringify(check.rows[0]));
  const env = [
    "NEXT_PUBLIC_SUPABASE_URL=https://laucgpcunnoplyzqdeem.supabase.co",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=",
    "SUPABASE_SERVICE_ROLE_KEY=",
    `RATE_LIMIT_SECRET=${(await import("node:crypto")).randomBytes(32).toString("hex")}`,
  ];
  let prior = "";
  try {
    prior = await readFile(".env.local", "utf8");
  } catch {}
  if (!prior) await writeFile(".env.local", env.join("\n") + "\n");
} catch (e) {
  console.error(
    "Database setup failed:",
    e.code ?? "ERROR",
    e.message?.replaceAll(config.password, "[redacted]"),
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
