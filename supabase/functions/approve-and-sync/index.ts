// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendApprovalEmail } from "../_shared/resendEmail.ts";

/* ---------------- CORS helpers ---------------- */
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
function ok(headers: HeadersInit, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status: 200, headers });
}
function safeJson(s: string) { try { return JSON.parse(s); } catch { return { raw: s }; } }

/* ---------------- Env ---------------- */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DISCOURSE_BASE = (Deno.env.get("DISCOURSE_BASE_URL") || "").replace(/\/+$/, "");
const DISCOURSE_KEY  = Deno.env.get("DISCOURSE_ADMIN_API_KEY")!;
const DISCOURSE_USER = Deno.env.get("DISCOURSE_ADMIN_API_USERNAME") || "system";
const DISCOURSE_SSO_SECRET = Deno.env.get("DISCOURSE_SSO_SECRET")!;
const SEND_ACTIVATION = (Deno.env.get("SEND_DISCOURSE_ACTIVATION") || "false").toLowerCase() === "true";
const XACCESS_GROUP = (Deno.env.get("XACCESS_GROUP") || "").trim();

/* ---------------- Utilities ---------------- */
async function hmacHex(input: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeGender(g: string): "men" | "women" | "" {
  const v = (g || "").toLowerCase().trim();
  if (["men", "male", "m"].includes(v)) return "men";
  if (["women", "woman", "female", "f"].includes(v)) return "women";
  return "";
}

function nameFrom(reg: any) {
  const parts = [
    (reg?.firstName ?? "").toString().trim(),
    (reg?.lastName ?? "").toString().trim(),
  ].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return (reg?.full_name ?? reg?.username ?? "").toString().trim();
}


/* ---------------- Discourse (SSO sync) ---------------- */
async function discourseSyncSSO(payload: Record<string, string>) {
  const qs = new URLSearchParams(payload).toString();
  const b64 = btoa(qs);
  const sig = await hmacHex(b64, DISCOURSE_SSO_SECRET);

  const form = new URLSearchParams();
  form.set("sso", b64);
  form.set("sig", sig);
  if (SEND_ACTIVATION) form.set("require_activation", "true");

  const res = await fetch(`${DISCOURSE_BASE}/admin/users/sync_sso`, {
    method: "POST",
    headers: {
      "Api-Key": DISCOURSE_KEY,
      "Api-Username": DISCOURSE_USER,
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: form.toString(),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Discourse sync_sso failed: ${res.status} ${text}`);
  }
  return safeJson(text);
}

/* ---------------- Handler ---------------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  const headers = cors(req);
  if (req.method !== "POST") return jerr(headers, 405, "Method not allowed");

  try {
    const body = await req.json().catch(() => ({} as any));
    const registrationId: string | undefined = body.registration_id ?? body.user_id;
    if (!registrationId) return jerr(headers, 400, "registration_id (or user_id) is required");

    // *** IMPORTANT CHANGE: use Service-Role client ONLY (no caller Authorization header) ***
    const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

    // TEMP: removed admin-only check for now while debugging "Registration not found"
    // const { data: auth } = await supa.auth.getUser();
    // if (!auth?.user) return jerr(headers, 401, "Unauthorized");
    // const { data: me, error: meErr } = await supa
    //   .from("profiles").select("id, is_admin").eq("id", auth.user.id).single();
    // if (meErr || !me?.is_admin) return jerr(headers, 403, "Forbidden: admin only");

    // Optionally allow gender/xaccess from body; otherwise read from DB
    const bodyGender = normalizeGender(String(body.gender ?? ""));
    const xaccessFlag = Boolean(body.xaccess ?? false);

    // Load registration
    const { data: reg, error: regErr } = await supa
      .from("registrations")
      .select("id, email, username, firstName, lastName, full_name, gender, status, email_code, email_code_expiry")
      .eq("id", registrationId)
      .single();

    if (regErr || !reg) {
      console.error("registrations lookup failed", { registrationId, regErr });
      return jerr(headers, 404, "Registration not found");
    }

    const username = String(reg.username || "").trim();
    const email    = String(reg.email || "").trim();
    if (!username || !email) return jerr(headers, 400, "username and email are required");

    const genderNorm = bodyGender || normalizeGender(String(reg.gender || ""));
    if (!genderNorm) return jerr(headers, 400, "gender must be 'men' or 'women'");

    // Build SSO groups (e.g., "men" or "women", optionally plus XACCESS_GROUP)
    const groups = [genderNorm, xaccessFlag && XACCESS_GROUP].filter(Boolean).join(",");

    // 1) Sync to Discourse via SSO
    const displayName = nameFrom(reg) || username;
    await discourseSyncSSO({
      external_id: reg.id,
      email,
      username,
      name: displayName,
      add_groups: groups,
    });

    // 2) Update our registration record as approved
    await supa.from("registrations")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", reg.id);

    // 3) Send one approval email via Resend (non-fatal if it fails)
    const emailApproved = await sendApprovalEmail(email, String(reg.firstName || "").trim() || username)
      .catch((err) => ({ success: false, error: String(err) }));

    return ok(headers, {
      ok: true,
      registration_id: reg.id,
      discourse: {
        synced_via_sso: true,
        add_groups: groups,
      },
      emails: {
        approved: emailApproved,
      },
    });

  } catch (e: unknown) {
    const err = e as { message?: string; stack?: string };
    console.error("approve-and-sync error:", err?.message, err?.stack);
    return jerr(headers, 500, err?.message ?? "Unknown error");
  }
});
