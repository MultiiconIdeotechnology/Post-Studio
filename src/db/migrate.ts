import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./index.js";

// Plain SQL files in src/db/migrations, applied once each in filename order.
export async function migrate(): Promise<string[]> {
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = join(here, "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query(
      "create table if not exists schema_migration (name text primary key, applied_at timestamptz not null default now())",
    );
    for (const f of files) {
      const done = await client.query("select 1 from schema_migration where name = $1", [f]);
      if (done.rowCount) continue;
      await client.query("begin");
      try {
        await client.query(readFileSync(join(dir, f), "utf8"));
        await client.query("insert into schema_migration (name) values ($1)", [f]);
        await client.query("commit");
        applied.push(f);
      } catch (e) {
        await client.query("rollback");
        throw e;
      }
    }
  } finally {
    client.release();
  }
  return applied;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  migrate()
    .then((a) => {
      console.log(a.length ? `Applied ${a.join(", ")}` : "Database is up to date");
      return pool.end();
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
