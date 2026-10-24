import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
const files = readdirSync("specs/hurl")
  .filter((f) => f.endsWith(".hurl"))
  .map((f) => `specs/hurl/${f}`);
const result = spawnSync(
  "hurl",
  [
    "--test",
    "--jobs",
    "1",
    "--variable",
    `host=${process.env.API_HOST ?? "http://localhost:8000"}`,
    "--variable",
    `uid=${Date.now()}`,
    ...files,
  ],
  { stdio: "inherit" },
);
if (result.error) {
  console.error(
    "Install Hurl and ensure it is on PATH: https://hurl.dev/docs/installation.html",
  );
  process.exit(1);
}
process.exit(result.status ?? 1);
