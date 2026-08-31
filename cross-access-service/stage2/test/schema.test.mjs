// Stage 2 schema verification — runs the core migration against real Postgres
// (pglite, in-process WASM) and exercises the exact SQL the revocation worker relies on.
//
//   node schema.test.mjs
//
// Proves, against real Postgres semantics:
//   1. the migration applies cleanly
//   2. the "due grants" query the worker runs selects only active + expired rows
//   3. the partial unique index enforces one active grant per member (the 409 guard)
//   4. revoking a grant frees that member to receive a new one
//   5. the worker's status-update path marks rows revoked as expected
//
// The pg_cron schedule migration is not exercised here: pg_cron/pg_net are hosted
// Supabase extensions unavailable in pglite. It is validated against a real project.

import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORE_MIGRATION = path.join(__dirname, "..", "supabase", "migrations", "20260716000000_cross_access_core.sql");

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

const db = new PGlite();

async function main() {
  console.log("\n  Stage 2 schema test (pglite / real Postgres)\n");

  // 1. migration applies
  const sql = readFileSync(CORE_MIGRATION, "utf8");
  await db.exec(sql);
  const tables = await db.query(
    `select table_name from information_schema.tables where table_schema='public' order by table_name`,
  );
  const names = tables.rows.map((r) => r.table_name);
  check("migration applies; 3 core tables exist", ["cross_access_grants", "cross_access_log", "cross_access_members"].every((t) => names.includes(t)));

  // seed one member
  const memberId = crypto.randomUUID();
  await db.query(
    `insert into cross_access_members (external_id, username, email, gender, verified) values ($1,'nova','nova@stage2.local','women','plus')`,
    [memberId],
  );

  // 2. an active grant already past expiry, plus one still in the future
  await db.query(
    `insert into cross_access_grants (user_external_id, username, base_gender, source, expires_at, status)
     values ($1,'nova','women','stripe_24h', now() - interval '1 hour', 'active')`,
    [memberId],
  );
  const member2 = crypto.randomUUID();
  await db.query(`insert into cross_access_members (external_id, username, email, gender) values ($1,'kai','kai@stage2.local','men')`, [member2]);
  await db.query(
    `insert into cross_access_grants (user_external_id, username, base_gender, source, expires_at, status)
     values ($1,'kai','men','stripe_monthly', now() + interval '20 days', 'active')`,
    [member2],
  );

  // the worker's exact "find due" query
  const due = await db.query(
    `select id, username from cross_access_grants where status='active' and expires_at <= now()`,
  );
  check("due-grants query returns only the expired active grant", due.rows.length === 1 && due.rows[0].username === "nova");

  // 3. one-active-grant partial unique index blocks a second active grant
  let blocked = false;
  try {
    await db.query(
      `insert into cross_access_grants (user_external_id, username, base_gender, source, expires_at, status)
       values ($1,'nova','women','stripe_3day', now() + interval '3 days', 'active')`,
      [memberId],
    );
  } catch { blocked = true; }
  check("partial unique index blocks a second active grant (the 409 guard)", blocked);

  // 4. worker's revoke update path
  const dueId = due.rows[0].id;
  await db.query(
    `update cross_access_grants set status='revoked', revoked_at=now(), revocation_synced=true, revoke_reason='expired' where id=$1`,
    [dueId],
  );
  const revoked = await db.query(`select status, revocation_synced from cross_access_grants where id=$1`, [dueId]);
  check("revoke update marks grant revoked + synced", revoked.rows[0].status === "revoked" && revoked.rows[0].revocation_synced === true);

  // 5. after revoke, the member can receive a new active grant (index freed)
  let regranted = true;
  try {
    await db.query(
      `insert into cross_access_grants (user_external_id, username, base_gender, source, expires_at, status)
       values ($1,'nova','women','stripe_3day', now() + interval '3 days', 'active')`,
      [memberId],
    );
  } catch { regranted = false; }
  check("member can be re-granted after previous grant is revoked", regranted);

  // 6. no due grants remain (both active grants are now in the future)
  const dueAfter = await db.query(`select count(*)::int as n from cross_access_grants where status='active' and expires_at <= now()`);
  check("no due grants remain after sweep", dueAfter.rows[0].n === 0);

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  await db.close();
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
