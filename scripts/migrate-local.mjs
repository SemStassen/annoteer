import { readFile, readdir } from "node:fs/promises";
const migrations = new URL("../packages/annoteer/infrastructure/migrations/", import.meta.url);
export async function migrateLocal(db) {
  await db
    .prepare("CREATE TABLE IF NOT EXISTS annoteer_local_migrations (name TEXT PRIMARY KEY)")
    .run();
  for (const file of (await readdir(migrations)).filter((name) => name.endsWith(".sql")).sort()) {
    if (
      await db
        .prepare("SELECT name FROM annoteer_local_migrations WHERE name = ?")
        .bind(file)
        .first()
    )
      continue;
    const statements = (await readFile(new URL(file, migrations), "utf8"))
      .split(";")
      .filter((sql) => sql.trim())
      .map((sql) => db.prepare(sql));
    await db.batch([
      ...statements,
      db.prepare("INSERT INTO annoteer_local_migrations (name) VALUES (?)").bind(file),
    ]);
  }
}
