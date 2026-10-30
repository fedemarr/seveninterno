import { createClient } from "@supabase/supabase-js";
if (process.stdin.isTTY) process.stdin.setRawMode(true);
console.log("Ready for administrator accounts on hidden stdin.");
process.stdin.resume();
const accounts = await new Promise((resolve) => {
  let buffer = "";
  process.stdin.on("data", (chunk) => {
    buffer += chunk.toString();
    if (/[\r\n]/.test(buffer)) resolve(JSON.parse(buffer.trim()));
  });
});
if (process.stdin.isTTY) process.stdin.setRawMode(false);
process.stdin.pause();
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
for (const account of accounts) {
  const { data, error } = await db.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
  });
  if (error) {
    console.error("Could not create account:", account.email, error.message);
    process.exitCode = 1;
    continue;
  }
  const { error: roleError } = await db
    .from("admin_users")
    .insert({ id: data.user.id, role: account.role });
  if (roleError) {
    console.error(
      "Could not assign administrator role:",
      account.email,
      roleError.message,
    );
    process.exitCode = 1;
    continue;
  }
  console.log("Administrator created:", account.email);
}
