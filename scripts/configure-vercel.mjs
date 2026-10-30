// Send values on stdin directly to the Vercel CLI. Never print credentials.
import { readFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";
const cli =
  process.platform === "win32"
    ? join(process.env.APPDATA, "npm/node_modules/vercel/dist/index.js")
    : process.env.VERCEL_CLI_PATH;
if (!cli || !existsSync(cli))
  throw new Error(
    "Set VERCEL_CLI_PATH to your installed Vercel CLI entrypoint.",
  );
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at), line.slice(at + 1).replace(/^"|"$/g, "")];
    }),
);
for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RATE_LIMIT_SECRET",
]) {
  if (!env[key]) throw new Error(`Missing ${key}`);
  for (const target of ["production", "preview"])
    await new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          cli,
          "env",
          "add",
          key,
          target,
          "--force",
          "--type",
          key.startsWith("NEXT_PUBLIC_") ? "config" : "secret",
        ],
        { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
      );
      let output = "";
      child.stdout.on("data", (chunk) => (output += chunk));
      child.stderr.on("data", (chunk) => (output += chunk));
      child.stdin.end(env[key] + "\n");
      child.on("error", reject);
      child.on("close", (code) => {
        if (code !== 0)
          reject(
            new Error(
              `Could not configure ${key} for ${target}: ${output.replaceAll(env[key], "[redacted]")}`,
            ),
          );
        else {
          console.log(`Configured ${key} for ${target}.`);
          resolve();
        }
      });
    });
}
