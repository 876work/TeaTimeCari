// Cross-Access Service · Stage 2 — data parity import
//
// Reads the SOURCE (production Supabase, READ-ONLY) and writes member + active-grant
// rows into the TARGET (the isolated Stage 2 project), PRESERVING external_id.
//
// Why ID preservation is non-negotiable: external_id is the permanent DiscourseConnect
// key (docs/discourse-sso-identity.md). If Stage 2 issued new ids, every existing
// member's Discourse association would break at cutover. This script therefore copies
// registrations.id straight through as cross_access_members.external_id and never
// generates a new one.
//
// Safety:
//   - DRY RUN by default. Pass --commit to actually write to the target.
//   - Refuses to run if TARGET_SUPABASE_URL matches PROD_URL_GUARD (set that env to
//     your production URL so a fat-fingered target can never be written to).
//   - Only ever SELECTs from the source. Never writes to it.
//
// Usage:
//   SOURCE_SUPABASE_URL=... SOURCE_SERVICE_ROLE_KEY=... \
//   TARGET_SUPABASE_URL=... TARGET_SERVICE_ROLE_KEY=... \
//   PROD_URL_GUARD=https://<prod-ref>.supabase.co \
//   node import-from-production.mjs [--commit]

import { createClient } from "@supabase/supabase-js";

const COMMIT = process.argv.includes("--commit");
const {
  SOURCE_SUPABASE_URL,
  SOURCE_SERVICE_ROLE_KEY,
  TARGET_SUPABASE_URL,
  TARGET_SERVICE_ROLE_KEY,
  PROD_URL_GUARD,
} = process.env;

function fail(msg) {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(1);
}

if (!SOURCE_SUPABASE_URL || !SOURCE_SERVICE_ROLE_KEY) fail("SOURCE_SUPABASE_URL and SOURCE_SERVICE_ROLE_KEY are required.");
if (!TARGET_SUPABASE_URL || !TARGET_SERVICE_ROLE_KEY) fail("TARGET_SUPABASE_URL and TARGET_SERVICE_ROLE_KEY are required.");
if (PROD_URL_GUARD && TARGET_SUPABASE_URL.replace(/\/+$/, "") === PROD_URL_GUARD.replace(/\/+$/, "")) {
  fail("TARGET matches PROD_URL_GUARD — refusing to write to production. Point TARGET at the Stage 2 project.");
}

const source = createClient(SOURCE_SUPABASE_URL, SOURCE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const target = createClient(TARGET_SUPABASE_URL, TARGET_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const normGender = (g) => {
  const s = (g || "").trim().toLowerCase();
  if (s === "male" || s === "men") return "men";
  if (s === "female" || s === "women") return "women";
  return null;
};

async function main() {
  console.log(`\n  Cross-Access Stage 2 · data parity import  [${COMMIT ? "COMMIT" : "DRY RUN"}]`);
  console.log(`  source: ${SOURCE_SUPABASE_URL}  (read-only)`);
  console.log(`  target: ${TARGET_SUPABASE_URL}\n`);

  // --- Members: approved registrations -> cross_access_members (id preserved) ---
  const { data: regs, error: regErr } = await source
    .from("registrations")
    .select("id, username, email, gender, status")
    .eq("status", "approved");
  if (regErr) fail(`reading registrations: ${regErr.message}`);

  const members = [];
  const skipped = [];
  for (const r of regs ?? []) {
    const gender = normGender(r.gender);
    if (!gender) { skipped.push(r.id); continue; }
    members.push({
      external_id: r.id, // PRESERVED — this is the DiscourseConnect external_id
      username: r.username || (r.email || "user").split("@")[0],
      email: r.email,
      gender,
      verified: "kyc", // every approved member has passed KYC; Verified+ is a separate upgrade
    });
  }

  // --- Active grants: unexpired 'opposite' payments -> cross_access_grants ---
  const nowIso = new Date().toISOString();
  const { data: pays, error: payErr } = await source
    .from("payments")
    .select("user_id, feed_access, status, expires_at, created_at")
    .eq("feed_access", "opposite")
    .eq("status", "completed")
    .gt("expires_at", nowIso);
  if (payErr) fail(`reading payments: ${payErr.message}`);

  const memberById = Object.fromEntries(members.map((m) => [m.external_id, m]));
  const grants = [];
  for (const p of pays ?? []) {
    const m = memberById[p.user_id];
    if (!m) continue; // paid but not an approved member in scope — skip
    grants.push({
      user_external_id: p.user_id, // PRESERVED
      username: m.username,
      base_gender: m.gender,
      source: "stripe_3day",
      checkout_source: "import",
      granted_at: p.created_at,
      expires_at: p.expires_at,
      status: "active",
    });
  }

  console.log(`  members to import: ${members.length}  (skipped ${skipped.length} with unrecognized gender)`);
  console.log(`  active grants to import: ${grants.length}\n`);

  if (!COMMIT) {
    console.log("  DRY RUN — nothing written. Re-run with --commit to apply.\n");
    console.log("  sample member:", members[0] ? JSON.stringify(members[0]) : "(none)");
    console.log("  sample grant: ", grants[0] ? JSON.stringify(grants[0]) : "(none)");
    console.log("");
    return;
  }

  // upsert on the preserved primary key so re-running is idempotent
  const { error: mErr } = await target.from("cross_access_members").upsert(members, { onConflict: "external_id" });
  if (mErr) fail(`writing members: ${mErr.message}`);
  const { error: gErr } = await target.from("cross_access_grants").insert(grants);
  if (gErr) fail(`writing grants: ${gErr.message}`);

  console.log(`  ✓ imported ${members.length} members and ${grants.length} active grants.\n`);
}

main().catch((e) => fail(e.message));
