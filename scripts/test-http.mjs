import assert from "node:assert/strict";
const base = process.env.SEVEN_TEST_URL ?? "http://localhost:3000";
if (process.stdin.isTTY) process.stdin.setRawMode(true);
console.log("Ready for test login on hidden stdin.");
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
let count = 0;
for (const path of [
  "/",
  "/inscripcion",
  "/equipos",
  "/fixture",
  "/posiciones",
  "/copas",
  "/login",
  "/privacidad",
]) {
  const r = await fetch(base + path);
  assert.equal(r.status, 200, path);
  const html = await r.text();
  assert.ok(!html.includes("SUPABASE_SERVICE_ROLE_KEY"));
  count++;
}
const unauth = await fetch(base + "/admin", { redirect: "manual" });
assert.ok([307, 303].includes(unauth.status));
count++;
const forbidden = await fetch(base + "/api/admin", {
  method: "POST",
  headers: { Origin: base, "Content-Type": "application/json" },
  body: "{}",
});
assert.equal(forbidden.status, 400);
count++;
const login = await fetch(base + "/api/auth", {
  method: "POST",
  headers: { Origin: base, "Content-Type": "application/json" },
  body: JSON.stringify(credentials),
});
assert.equal(login.status, 200, await login.text());
count++;
const cookie = login.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ");
for (const path of [
  "/admin",
  "/admin/inscripciones",
  "/admin/pagos",
  "/admin/jugadores",
  "/admin/evaluaciones",
  "/admin/equipos",
  "/admin/generador",
  "/admin/configuracion-torneo",
  "/admin/fixture",
  "/admin/torneo",
  "/admin/resultados",
  "/admin/copas",
  "/admin/configuracion",
]) {
  const r = await fetch(base + path, { headers: { cookie } });
  assert.equal(r.status, 200, path);
  const html = await r.text();
  assert.ok(html.includes("Cerrar sesión"), path);
  count++;
}
const foreign = await fetch(base + "/api/admin", {
  method: "POST",
  headers: {
    Origin: "https://other.example",
    cookie,
    "Content-Type": "application/json",
  },
  body: "{}",
});
assert.equal(foreign.status, 403);
count++;
const closed = await fetch(base + "/api/inscripcion", {
  method: "POST",
  headers: { Origin: base, "Content-Type": "application/json" },
  body: JSON.stringify({
    first_name: "Test",
    last_name: "NoSave",
    age: 25,
    category_id: "00000000-0000-0000-0000-000000000000",
    position_id: "00000000-0000-0000-0000-000000000000",
    phone: "1122223333",
    consent: true,
    public_consent: false,
    website: "",
  }),
});
assert.equal(closed.status, 400);
assert.match((await closed.json()).error, /inscripciones no están abiertas/);
count++;
const logout = await fetch(base + "/api/auth", {
  method: "DELETE",
  headers: { Origin: base, cookie },
});
assert.equal(logout.status, 200);
count++;
console.log(
  `PASS: ${count} HTTP checks: public pages, protected admin pages, real login, CSRF, closed registration and logout.`,
);
