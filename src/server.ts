import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createApp } from "./app.js";
import { Repository } from "./data.js";
const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32)
  throw new Error(
    "Set JWT_SECRET to at least 32 characters in .env (see .env.example).",
  );
const path = process.env.DATABASE_PATH ?? "data/conduit.sqlite";
mkdirSync(dirname(path), { recursive: true });
const repo = new Repository(path);
const server = createApp(repo, secret).listen(
  Number(process.env.PORT ?? 8000),
  "::",
  () =>
    console.log(`Conduit API: http://localhost:${process.env.PORT ?? 8000}`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(() => {
      repo.db.close();
      process.exit(0);
    }),
  );
