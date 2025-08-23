// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ---------------- CORS ---------------- */
function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") || "*")
    .split(",").map(s => s.trim()).filter(Boolean);
  const allowAny = allowed.includes("*");
  const allowOrigin = allowAny ? (origin || "*") : (allowed.includes(origin) ? origin : "");
  const reqHeaders = req.headers.get("access-control-request-headers")
    ?? "authorization, content-type, apikey, x-client-info, x-supabase-api-version";
  return {
    "Access-Control-Allow-Origin": allowOrigin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": reqHeaders,
    "Access-Control-Max-Age": "600",
    "Vary": "Origin, Access-Control-Request-Headers",
    "Content-Type": "application/json",
  } as Record<string, string>;
}
function jerr(headers: HeadersInit, status: number, msg: string) {
  return new Response(JSON.stringify({ ok: false, error: msg }), { status, headers });
}

/* ---------------- ENV ---------------- */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DISCOURSE_BASE = (Deno.env.get("DISCOURSE_BASE_URL") || "").replace(/\/+$/, "");
const DISCOURSE_KEY  = Deno.env.get("DISCOURSE_ADMIN_API_KEY")!;
const DISCOURSE_USER = Deno.env.get("DISCOURSE_ADMIN_API_USERNAME")!;

// Group names (exact slugs/names as they exist in Discourse)
const GROUP_MALE_NAME   = Deno.env.get("DISCOURSE_MALE_GROUP")   || "man-SLU";
const GROUP_FEMALE_NAME = Deno.env.get("DISCOURSE_FEMALE_GROUP") || "woman-SLU";

/* ------------- Discourse helpers ------------- */
async function getGroupIdByName(name: string) {
  const res = await fetch(`${DISCOURSE_BASE}/groups/${encodeURIComponent(name)}.json`, {
    headers: { "Api-Key": DISCOURSE_KEY, "Api-Username": DISCOURSE_USER },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Fetch group '${name}' failed: ${res.status} ${text}`);
  const json = JSON.parse(text);
  const id = json?.group?.id ?? json?.basic_group?.id;
  if (!id) throw new Error(`Could not resolve id for group '${name}'`);
  return id as number;
}

async function createDiscourseUser(name: string, email: string, username: string, password: string) {
  const res = await fetch(`${DISCOURSE_BASE}/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": DISCOURSE_KEY,
      "Api-Username": DISCOURSE_USER,
    },
    body: JSON.stringify({
      name,           // = username
      email,
      username,
      password,       // plaintext password
      active: true,   // account is ready immediately
      approved: true, // bypass approval queue
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Create user failed: ${res.status} ${text}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function addUsernamesToGroup(groupId: number, usernames: string[]) {
  const res = await fetch(`${DISCOURSE_BASE}/groups/${groupId}/members.json`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": DISCOURSE_KEY,
      "Api-Username": DISCOURSE_USER,
    },
    body: JSON.stringify({ usernames: usernames.join(",") }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Add-to-group failed: ${res.status} ${text}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

/* ---------------- Handler ---------------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  const headers = cors(req);
  if (req.method !== "POST") return jerr(headers, 405, "Method not allowed");

  try {
    const body = await req.json().catch(() => ({}));
    const registrationId: string | undefined = body.registration_id ?? body.user_id;
    if (!registrationId) return jerr(headers, 400, "registration_id (or user_id) is required");

    // Supabase client w/ service role; keep caller's JWT to check admin
    const supa = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    // must be an authenticated admin
    const { data: auth } = await supa.auth.getUser();
    if (!auth?.user) return jerr(headers, 401, "Unauthorized");
    const { data: me, error: meErr } = await supa
      .from("profiles").select("id, is_admin").eq("id", auth.user.id).single();
    if (meErr || !me?.is_admin) return jerr(headers, 403, "Forbidden: admin only");

    // load registration; we need username, email, password, gender
    const { data: reg, error: regErr } = await supa
      .from("registrations")
      .select("id, email, username, gender, password_temp, status")
      .eq("id", registrationId)
      .single();

    if (regErr || !reg) return jerr(headers, 404, "Registration not found");

    // Normalize fields
    const username = String(reg.username || "").trim();
    const email    = String(reg.email || "").trim();
    const password = String(reg.password_temp || body.password || "").trim(); // fallback if you pass password in body
    const gender   = String(reg.gender || "").toLowerCase();

    if (!username || !email || !password) {
      return jerr(headers, 400, "username, email, and password are required on the registration row");
    }
    if (gender !== "male" && gender !== "female") {
      return jerr(headers, 400, "gender must be 'male' or 'female'");
    }

    // Resolve Discourse group id by group name
    const groupName = gender === "male" ? GROUP_MALE_NAME : GROUP_FEMALE_NAME;
    const groupId = await getGroupIdByName(groupName);

    // Create user in Discourse (name = username)
    const created = await createDiscourseUser(username, email, username, password);
    const createdUsername = created?.user?.username || created?.username || username;

    // Add to gender group
    if (createdUsername) {
      await addUsernamesToGroup(groupId, [createdUsername]);
    }

    // Mark approved now that Discourse succeeded
    await supa
      .from("registrations")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", reg.id);

    // Optionally persist returned IDs if you have columns (wrapped to avoid breaking if absent)
    try {
      await supa.from("registrations")
        .update({
          discourse_user_id: created?.user_id ?? created?.id ?? null,
          discourse_username: createdUsername ?? null,
        })
        .eq("id", reg.id);
    } catch { /* ignore if columns don't exist */ }

    return new Response(JSON.stringify({
      ok: true,
      registration_id: reg.id,
      discourse: { created: !!createdUsername, username: createdUsername, group: groupName },
    }), { status: 200, headers });
  } catch (e: any) {
    console.error("approve-and-sync error:", e?.message, e?.stack);
    return jerr(headers, 500, e?.message ?? "Unknown error");
  }
});
