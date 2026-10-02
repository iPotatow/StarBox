import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

// Execute the production SQL, rather than reimplementing its effects in JavaScript.
export function sqliteDatabase(schema = readFileSync(new URL("../migrations/0001_schema.sql", import.meta.url), "utf8")) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  sqlite.exec(schema);
  let tail = Promise.resolve();
  const DB = {
    prepare(sql) {
      const prepared = sqlite.prepare(sql.replace(/\?(\d+)/g, ":p$1"));
      let bindings = {};
      return {
        bind(...values) { bindings = Object.fromEntries(values.map((value, index) => [`p${index + 1}`, value ?? null])); return this; },
        async run() { const result = prepared.run(bindings); return { success: true, meta: { changes: Number(result.changes) } }; },
        async all() { return { success: true, results: prepared.all(bindings) }; },
        async first(column) { const row = prepared.get(bindings); return row ? column ? row[column] : row : null; },
      };
    },
    async batch(statements) {
      const previous = tail; let release;
      tail = new Promise((resolve) => { release = resolve; });
      await previous;
      sqlite.exec("BEGIN");
      try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec("COMMIT"); return results; }
      catch (reason) { sqlite.exec("ROLLBACK"); throw reason; }
      finally { release(); }
    },
  };
  return { sqlite, DB, close: () => sqlite.close() };
}
