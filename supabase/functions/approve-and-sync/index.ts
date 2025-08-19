// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- Env ---
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DISCOURSE_BASE = Deno.env.get("DISCOURSE_BASE_URL")!;
const DISCOURSE_KEY = Deno.env.get("DISCOURSE_ADMIN_API_KEY")!;
const DISCOURSE_USER = Deno.env.get("DISCOURSE_ADMIN_API_USERNAME")!;

const MODE = (Deno.env.get("DISCOURSE_MODE") || "invite").toLowerCase(); // "invite" | "create"
const GROUP_MALE = Deno.env.get("DISCOURSE_MALE_GROUP") || "men-SLU";
const GROUP_FEMALE = Deno.env.get("DISCOURSE_FEMALE_GROUP") || "women-SLU";
const GROUP_XACCESS = Deno.env.get("DISCOURSE_XACCESS_GROUP") || "xaccess-SLU";

const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",").map(s => s.trim()).filter(Boolean);

// --- Helpers ---
function corsHeaders(origin: string | null) {
  const allowOrigin = origin && (ALLOWED.includes("*") || ALLOWED.includes(origin))
    ? origin
    : (ALLOWED[0] || "*");
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

async function inviteUserToDiscourse(email: string, groupName: string) {
  const res = await fetch(`${DISCOURSE_BASE}/invites.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": DISCOURSE_KEY,
      "Api-Username": DISCOURSE_USER,
    },
    body: JSON.stringify({ email, group_names: [groupName] }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Discourse invite failed: ${res.status} ${text}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function addUserToGroup(groupName: string, usernames: string[]) {
  const res = await fetch(`${DISCOURSE_BASE}/groups/${groupName}/members.json`, {
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

async function createUserInDiscourse(name: string, email: string, username: string) {
  const res = await fetch(`${DISCOURSE_BASE}/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": DISCOURSE_KEY,
      "Api-Username": DISCOURSE_USER,
    },
    body: JSON.stringify({
      name,
      email,
      username,
      password: crypto.randomUUID() + "Aa1!",
      active: true,
      approved: true,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Create user failed: ${res.status} ${text}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

serve(async (req) => {
  const headers = corsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  try {
    const body = await req.json() as { registration_id?: string };
    if (!body?.registration_id) {
      return new Response(JSON.stringify({ error: "registration_id is required" }), { status: 400, headers });
    }

    // Use service role for DB, but pass caller's JWT for admin check
    const supa = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    // Caller must be an authenticated admin
    const { data: auth } = await supa.auth.getUser();
    if (!auth?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

    const { data: profile, error: profErr } = await supa
      .from("profiles").select("id,is_admin").eq("id", auth.user.id).single();
    if (profErr || !profile?.is_admin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), { status: 403, headers });
    }

    // Load registration - use firstName and lastName instead of full_name
    const { data: reg, error: regErr } = await supa
      .from("registrations")
      .select("id,email,firstName,lastName,username,gender,status")
      .eq("id", body.registration_id)
      .single();
    if (regErr || !reg) return new Response(JSON.stringify({ error: "Registration not found" }), { status: 404, headers });
    if (reg.status !== "pending") {
      return new Response(JSON.stringify({ error: `Cannot approve from status ${reg.status}` }), { status: 409, headers });
    }

    // Convert gender to lowercase for group selection
    const genderLower = reg.gender.toLowerCase() as "male" | "female";
    const groupName = genderLower === "male" ? GROUP_MALE : GROUP_FEMALE;
    if (!groupName) return new Response(JSON.stringify({ error: "Group name not configured" }), { status: 500, headers });

    // Mark approved locally (dashboard reflects action)
    const { error: updErr } = await supa
      .from("registrations")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", reg.id);
    if (updErr) return new Response(JSON.stringify({ error: `DB update failed: ${updErr.message}` }), { status: 500, headers });

    let result: any = null;
    const fullName = `${reg.firstName} ${reg.lastName}`.trim();

    if (MODE === "invite") {
      result = await inviteUserToDiscourse(reg.email, groupName); // Discourse sends the email
      // Note: discourse_invite_id column may not exist in registrations table
      try {
        await supa.from("registrations").update({ 
          // discourse_invite_id: result?.invite?.id ?? null 
        }).eq("id", reg.id);
      } catch (e) {
        console.warn("Could not update discourse_invite_id:", e);
      }
    } else {
      const created = await createUserInDiscourse(fullName, reg.email, reg.username);
      const createdUsername = created?.user?.username || created?.username || reg.username;
      if (createdUsername) await addUserToGroup(groupName, [createdUsername]);
      // Note: discourse_user_id and discourse_username columns may not exist
      try {
        await supa.from("registrations").update({
          // discourse_user_id: created?.user_id ?? created?.id ?? null,
          // discourse_username: createdUsername ?? null,
        }).eq("id", reg.id);
      } catch (e) {
        console.warn("Could not update discourse fields:", e);
      }
      result = { created };
    }

    return new Response(JSON.stringify({ ok: true, mode: MODE, registration_id: reg.id, discourse: result }), {
      status: 200, headers,
    });
  } catch (e: any) {
    console.error("approve-and-sync error:", e?.message, e?.stack);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), { status: 500, headers });
  }
});