import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { command } from "../mods/practice-range/runner.mjs";
import { completeSetup } from "../mods/practice-range/setup.mjs";
import { findLanguage } from "../mods/practice-range/languages/index.js";
import { catalogFor } from "../mods/practice-range/catalog.js";
import { checkAnswer } from "../mods/practice-range/languages/sql/runner.mjs";

const sql = catalogFor(findLanguage("sql"));
// Setup checks the editor command. These tests stub it so they never depend on a local editor.
const installed = { run: async () => ({ code: 0, stdout: "test", stderr: "", problem: "" }) };

async function scratch(t, name) {
  const root = await mkdtemp(join(tmpdir(), `syntax-sql-${name}-`));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

const saved = state => JSON.stringify({ languageId: state.languageId, exerciseId: state.exerciseId, sourceHash: state.sourceHash });

test("SQL practice uses its own directory, writes schema.sql, and checks saved answers", { timeout: 180000 }, async t => {
  const root = await scratch(t, "flow");
  await completeSetup(root, "neovim", "sql", installed);
  let state = await command(root, "status");
  assert.equal(state.languageId, "sql");
  assert.equal(state.exerciseId, "select/star");
  assert.equal(state.root, join(root, "languages", "sql"));
  assert.equal(state.file, join(root, "languages", "sql", "answers", "select", "star", "Exercise.sql"));
  assert.equal(state.runtimeVersion, "PGlite 0.5.16 (PostgreSQL 18)");
  assert.equal(await readFile(state.file, "utf8"), "-- Write your SQL here. Save to check.\n");
  assert.match(await readFile(join(state.folder, "schema.sql"), "utf8"), /CREATE TABLE categories[\s\S]*INSERT INTO assignments/);
  const readme = await readFile(join(state.folder, "README.md"), "utf8");
  assert.match(readme, /Tables:\n\n```sql\nCREATE TABLE categories/);
  assert.match(readme, /fresh copy of the practice database/);
  const schemaTime = (await stat(join(state.folder, "schema.sql"))).mtimeMs;
  await command(root, "hint");
  assert.equal((await stat(join(state.folder, "schema.sql"))).mtimeMs, schemaTime, "Unchanged editor files are not rewritten");

  state = await command(root, "check-saved", saved(state));
  assert.equal(state.result, null, "The generated starter is not a save attempt");
  await writeFile(state.file, "-- Every category\nselect *\nfrom categories;\n");
  state = await command(root, "check-saved", saved(state));
  assert.equal(state.result.passed, true, JSON.stringify(state.result));
  assert.equal(state.progress["select/star"].attempts, 1);
  const cache = await readdir(join(root, "languages", "sql", "cache"));
  assert.equal(cache.filter(name => name.endsWith(".tar")).length, 1, "The seeded database is cached once");
  assert.deepEqual(await readdir(join(root, "languages", "sql", "checks")), [], "Check files are removed");

  await writeFile(state.file, "SELECT *\nFROM categorys;\n");
  state = await command(root, "check");
  assert.equal(state.result.kind, "compile");
  assert.match(state.result.details[0], /^Exercise\.sql:2:6 - error 42P01: relation "categorys" does not exist$/);

  state = await command(root, "select", "functions/trim");
  assert.match(await readFile(join(state.folder, "setup.sql"), "utf8"), /UPDATE customers SET city/);
  assert.match(await readFile(join(state.folder, "README.md"), "utf8"), /-- Added for this exercise:\nUPDATE customers/);
});

test("SQL feedback separates errors, syntax, wrong rows, wrong order, and runaway queries", { timeout: 180000 }, async t => {
  const root = await scratch(t, "feedback");
  const check = (id, answer, options) => checkAnswer(root, sql.findExercise(id), answer, options);

  assert.equal((await check("sorting/order-desc", "   \n-- nothing yet\n")).title, "Write your SQL");
  const order = await check("sorting/order-asc", "SELECT name, price FROM products ORDER BY price DESC;");
  assert.equal(order.kind, "result");
  assert.match(order.details[0], /not in the requested order/);
  const unordered = await check("where/greater-than", "SELECT name, price FROM products WHERE price > 300 ORDER BY name DESC;");
  assert.equal(unordered.passed, true, "Row order only matters when the exercise asks for it");
  assert.match(unordered.details.at(-1), /^Your query returned:\n name +\| price\n-+\+-+\n Standing Desk +\| 549\.00\n[\s\S]*\n\(6 rows\)$/, "A passing check shows the rows the query returned");
  const long = await check("sorting/order-asc", "SELECT name, price FROM products ORDER BY price;");
  assert.match(long.details.at(-1), /\(24 rows, first 20 shown\)$/);
  const rows = await check("where/greater-than", "SELECT name, price FROM products WHERE price > 300 OR stock = 7;");
  assert.equal(rows.kind, "result");
  assert.match(rows.details.at(-1), /^Your query returned:[\s\S]* Soundbar +\| 249\.00\n[\s\S]*\(7 rows\)$/, "A failing check still shows what the query returned");
  assert.match(rows.details.slice(0, -1).join("\n"), /^Expected \d+ rows, got \d+\.\nNot expected: \(Soundbar, 249\.00\)\.$/);
  const columns = await check("where/greater-than", "SELECT name AS product, price FROM products WHERE price > 300;");
  assert.match(columns.details[0], /Name the columns name, price/);
  const unnamed = await check("select/expression", "SELECT name, price * stock FROM products;");
  assert.match(unnamed.details.join("\n"), /Give it one with AS/);
  const syntax = await check("aggregates/count-column", "SELECT COUNT(*) AS with_email FROM customers WHERE email IS NOT NULL;");
  assert.equal(syntax.kind, "syntax", "Correct rows still need the requested syntax");
  const numeric = await check("aggregates/avg", "SELECT ROUND(AVG(price)::numeric, 2) AS avg_price FROM products;");
  assert.equal(numeric.passed, true);
  const commented = await check("joins/left", "-- LEFT JOIN\nSELECT c.first_name, o.id AS order_id FROM customers AS c JOIN orders AS o ON o.customer_id = c.id;");
  assert.equal(commented.passed, false, "A comment can't stand in for the requested syntax");
  const runaway = await check("ctes/series", "WITH RECURSIVE numbers AS (SELECT 1 AS n UNION ALL SELECT n + 1 FROM numbers) SELECT n FROM numbers;", { timeout: 4000 });
  assert.equal(runaway.kind, "runtime");
  assert.match(runaway.details[0], /time limit/);
  const huge = await check("joins/cross", "SELECT c.first_name, cat.name AS category FROM customers AS c CROSS JOIN categories AS cat CROSS JOIN order_items;");
  assert.match(huge.details[0], /more than 5000 rows/);
});

test("data-changing exercises compare the data afterward and enforce new constraints", { timeout: 180000 }, async t => {
  const root = await scratch(t, "changes");
  const check = (id, answer) => checkAnswer(root, sql.findExercise(id), answer);

  assert.equal((await check("modify/update-one", "update products set stock = 50 where id = 6;")).passed, true);
  const wrongRow = await check("modify/update-one", "UPDATE products SET stock = 50 WHERE id = 7;");
  assert.equal(wrongRow.kind, "result");
  assert.match(wrongRow.details[0], /After your statements, this check gave a different result/);
  const shown = wrongRow.details.at(-1);
  assert.match(shown, /^Your statements changed 1 row\.\n\nBefore \(rows your statements changed or removed\):\n[\s\S]* 7 +\| 27in Monitor[^\n]*\| 15 [\s\S]*\(1 row\)\n\nAfter \(rows your statements changed or added\):\n[\s\S]* 7 +\| 27in Monitor[^\n]*\| 50 [\s\S]*\(1 row\)$/);
  const deleted = await check("modify/delete-where", "DELETE FROM reviews WHERE rating = 1;");
  assert.equal(deleted.passed, true);
  assert.match(deleted.details.at(-1), /^Your statements changed \d+ rows\.\n\nBefore \(rows your statements changed or removed\):/);
  const everyRow = await check("modify/update-one", "UPDATE products SET stock = 50;");
  assert.equal(everyRow.kind, "syntax", "Rules are reported before results, as in the other packs");
  const returning = await check("modify/update-returning", "UPDATE products SET stock = stock - 1 WHERE id = 1;");
  assert.equal(returning.passed, false, "RETURNING exercises compare the returned rows too");
  assert.equal((await check("ddl/check", "CREATE TABLE promotions (id integer PRIMARY KEY, name text NOT NULL, percent_off integer NOT NULL CHECK (percent_off >= 1 AND percent_off <= 90));")).passed, true);
  const loose = await check("ddl/check", "CREATE TABLE promotions (id integer PRIMARY KEY, name text NOT NULL, percent_off integer NOT NULL CHECK (percent_off > 0));");
  assert.match(loose.details[0], /should be rejected after your change/);
  const wrongType = await check("ddl/add-column", "ALTER TABLE customers ADD COLUMN phone integer;");
  assert.equal(wrongType.kind, "result");
  assert.match(wrongType.details.join("\n"), /\(phone, integer, YES\)/);
  assert.equal((await check("upsert/merge", "MERGE INTO product_stats t USING (SELECT product_id, SUM(quantity) AS units FROM order_items GROUP BY product_id) s ON t.product_id = s.product_id WHEN MATCHED THEN UPDATE SET units = s.units WHEN NOT MATCHED THEN INSERT VALUES (s.product_id, s.units);")).passed, true);
  // Every check restores the dataset, so changes from one check never leak into the next.
  assert.equal((await check("modify/update-one", "UPDATE products SET stock = 50 WHERE id = 6;")).passed, true);
});
