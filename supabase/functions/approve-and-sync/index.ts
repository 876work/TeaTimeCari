// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://teatimecari.app";
const XACCESS_GROUP = (Deno.env.get("XACCESS_GROUP") || "").trim();

/* ---------------- SendGrid config ---------------- */
const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? Deno.env.get("SENDGRID_FROM_EMAIL") ?? "";
const FROM_NAME  = Deno.env.get("FROM_NAME")  ?? Deno.env.get("SENDGRID_FROM_NAME")  ?? "Tea Time Cari";

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

function strongTempPassword(len = 14) {
  const dict = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789!@#$%^&*()_+-=";
  let out = "";
  crypto.getRandomValues(new Uint32Array(len)).forEach(n => out += dict[n % dict.length]);
  if (!/[A-Z]/.test(out)) out = "A" + out.slice(1);
  if (!/[a-z]/.test(out)) out = out.slice(0,1) + "a" + out.slice(2);
  if (!/[0-9]/.test(out)) out = out.slice(0,2) + "7" + out.slice(3);
  return out;
}

/* ---------------- SendGrid ---------------- */
async function sendWithSendgrid(to: string, subject: string, html: string, text: string) {
  if (!SENDGRID_API_KEY || !FROM_EMAIL) {
    return { sent: false, skipped: true as const, reason: "missing_sendgrid_or_from" };
  }
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
      content: [
        { type: "text/plain", value: text },
        { type: "text/html",  value: html },
      ],
    }),
  });
  const body = await res.text();
  return { sent: res.status >= 200 && res.status < 300, status: res.status, body: safeJson(body) };
}

function tplApproved(username: string, userCode: string) {
  const subject = "Your Account is Approved — Save Your User Code";
  const html = `
    <p>Hi <strong>${username}</strong>,</p>
    <p><strong>Great News — Your Account is Approved!</strong></p>
    <p><strong>User Code:</strong> ${userCode}</p>
    <p>Keep this code safe. You’ll need it if you ever contact Tea Time Cari Support.
    Our systems are highly encrypted; never share your account code with anyone except the Tea Time Cari support team.</p>
    <p><em>Next up:</em> a Welcome email from the Tea Time Cari Community should land in your inbox shortly with the login link.</p>
    <p>— Tea Time Cari Team</p>
  `;
  const text =
`Hi ${username},

Great News — Your Account is Approved!

User Code: ${userCode}
Keep this code safe. You’ll need it if you ever contact Tea Time Cari Support.
Our systems are highly encrypted; never share your account code with anyone except the Tea Time Cari support team.

Next up: a Welcome email from the Tea Time Cari Community should land in your inbox shortly with the login link.

— Tea Time Cari Team`;
  return { subject, html, text };
}

function tplWelcome(username: string, baseUrl: string) {
  const subject = "Welcome to Tea Time Cari Community";
  const loginUrl = `${APP_BASE_URL}/community`;
  const html = `
    <p>Hi <strong>${username}</strong>,</p>
    <p>Your Tea Time Cari Community account is ready.</p>
    <p><strong>Log in here:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
    <p>If you have trouble signing in, click “Forgot password” on the login page.
    You may also contact us at <a href="mailto:hello@teatimecari.app">hello@teatimecari.app</a>. Remember to include your user code when contacting support.</p>
    <p>— Tea Time Cari Team</p>
  `;
  const text =
`Hi ${username},

Your Tea Time Cari Community account is ready.

Log in here: ${loginUrl}

If you have trouble signing in, click “Forgot password” on the login page.
You may also contact us at hello@teatimecari.app. Remember to include your user code when contacting support.

— Tea Time Cari Team`;
  return { subject, html, text };
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

    // Ensure a user code exists to include in approval email
    let userCode: string = String(reg.email_code || "").trim();
    if (!userCode) {
      userCode = `SLU${Math.floor(100000 + Math.random() * 900000)}`;
      await supa
        .from("registrations")
        .update({
          email_code: userCode,
          email_code_expiry: reg.email_code_expiry ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", reg.id);
    }

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

    // 3) Send emails (non-fatal if they fail)
    const approvedTpl = tplApproved(username, userCode);
    const welcomeTpl  = tplWelcome(username, APP_BASE_URL);

    const emailApproved = await sendWithSendgrid(email, approvedTpl.subject, approvedTpl.html, approvedTpl.text)
      .catch(err => ({ sent: false, error: String(err) }));
    const emailWelcome = await sendWithSendgrid(email, welcomeTpl.subject, welcomeTpl.html, welcomeTpl.text)
      .catch(err => ({ sent: false, error: String(err) }));

    return ok(headers, {
      ok: true,
      registration_id: reg.id,
      discourse: {
        synced_via_sso: true,
        add_groups: groups,
      },
      emails: {
        approved: emailApproved,
        welcome:  emailWelcome,
      },
    });

  } catch (e: unknown) {
    const err = e as { message?: string; stack?: string };
    console.error("approve-and-sync error:", err?.message, err?.stack);
    return jerr(headers, 500, err?.message ?? "Unknown error");
  }
});