// supabase/functions/approve-and-sync/index.ts
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ---------------- CORS ---------------- */
function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") || "*")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const allowAny = allowed.includes("*");
  const allowOrigin = allowAny ? origin || "*" : (allowed.includes(origin) ? origin : "");
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
  const h = { ...headers, "X-Error-Message": msg };
  return new Response(JSON.stringify({ ok: false, error: msg }), { status, headers: h });
}

/* ---------------- ENV ---------------- */
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DISCOURSE_BASE = (Deno.env.get("DISCOURSE_BASE_URL") || "").replace(/\/+$/, "");
const DISCOURSE_KEY  = Deno.env.get("DISCOURSE_ADMIN_API_KEY")!;
const DISCOURSE_USER = Deno.env.get("DISCOURSE_ADMIN_API_USERNAME")!;

const GROUP_MALE_ID   = Number(Deno.env.get("MEN_GROUP")   || "0");
const GROUP_FEMALE_ID = Number(Deno.env.get("WOMEN_GROUP") || "0");

// SendGrid
const SENDGRID_API_KEY   = Deno.env.get("SENDGRID_API_KEY") || "";
const SENDGRID_FROM_EMAIL= Deno.env.get("SENDGRID_FROM_EMAIL") || "";
const SENDGRID_FROM_NAME = Deno.env.get("SENDGRID_FROM_NAME") || "Tea Time Cari Team";

/* ---------------- Helpers ---------------- */
function strongTempPassword(len = 14) {
  const dict = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789!@#$%^&*()_+-=";
  let out = "";
  crypto.getRandomValues(new Uint32Array(len)).forEach((n) => out += dict[n % dict.length]);
  if (!/[A-Z]/.test(out)) out = "A" + out.slice(1);
  if (!/[a-z]/.test(out)) out = out.slice(0, 1) + "a" + out.slice(2);
  if (!/[0-9]/.test(out)) out = out.slice(0, 2) + "7" + out.slice(3);
  return out;
}
function safeJson(s: string) { try { return JSON.parse(s); } catch { return { raw: s }; } }
function makeUserCode(prefix = "SLU") {
  const n = Math.floor(Math.random() * 900000) + 100000;
  return `${prefix}${n}`;
}

/* ---------------- Discourse calls ---------------- */
async function createUserLenient(name: string, email: string, username: string, password: string) {
  const payload: any = {
    name, email, username, password,
    active: true, approved: true,
    send_welcome_message: false,
  };
  const r = await fetch(`${DISCOURSE_BASE}/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": DISCOURSE_KEY,
      "Api-Username": DISCOURSE_USER,
      "Accept": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  const json = safeJson(text);
  if (r.ok) return { created: true, json, status: r.status };
  if (r.status === 409 || r.status === 422) {
    const t = typeof text === "string" ? text : JSON.stringify(json);
    const already = /already been taken|not available|has already|taken/i.test(t);
    if (already) return { created: false, reason: "exists", json, status: r.status };
  }
  throw new Error(`Create user failed: ${r.status} ${text}`);
}
async function getDiscourseUserId(username: string, email: string) {
  // by username
  {
    const r = await fetch(`${DISCOURSE_BASE}/u/${encodeURIComponent(username)}.json`, {
      headers: { "Api-Key": DISCOURSE_KEY, "Api-Username": DISCOURSE_USER, "Accept": "application/json" },
    });
    if (r.ok) {
      const j = await r.json().catch(() => ({}));
      const id = j?.user?.id ?? j?.user_id;
      if (id) return Number(id);
    }
  }
  // by email (admin)
  {
    const r = await fetch(`${DISCOURSE_BASE}/u/by-email/${encodeURIComponent(email)}.json`, {
      headers: { "Api-Key": DISCOURSE_KEY, "Api-Username": DISCOURSE_USER, "Accept": "application/json" },
    });
    if (r.ok) {
      const j = await r.json().catch(() => ({}));
      const id = j?.user?.id ?? j?.user_id;
      if (id) return Number(id);
    }
  }
  throw new Error(`Lookup user '${username}' failed (not found by username or email)`);
}
async function addUserIdToGroup(groupId: number, userId: number) {
  const form = new URLSearchParams();
  form.set("user_id", String(userId));
  const r = await fetch(`${DISCOURSE_BASE}/admin/groups/${groupId}/members.json`, {
    method: "PUT",
    headers: {
      "Api-Key": DISCOURSE_KEY,
      "Api-Username": DISCOURSE_USER,
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: form.toString(),
  });
  const text = await r.text();
  if (!r.ok) {
    if (/already/i.test(text)) return { ok: true, raw: safeJson(text) }; // already a member
    throw new Error(`Add-to-group failed: ${r.status} ${text}`);
  }
  return safeJson(text);
}

/* ---------------- Email (SendGrid) ---------------- */
async function sendWithSendGrid(to: string, subject: string, html: string) {
  if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL) {
    return { sent: false, skipped: true, reason: "missing SENDGRID_API_KEY or SENDGRID_FROM_EMAIL" };
    }
  const payload = {
    personalizations: [{ to: [{ email: to }], subject }],
    from: { email: SENDGRID_FROM_EMAIL, name: SENDGRID_FROM_NAME },
    content: [{ type: "text/html", value: html }],
  };
  const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`SendGrid failed: ${r.status} ${text}`);
  return { sent: true };
}

function htmlApproved(username: string, userCode: string) {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;color:#111">
    <p>Hi <strong>${escapeHtml(username)}</strong>,</p>
    <p><strong>Great News — Your Account is Approved!</strong></p>
    <p><strong>User Code:</strong> ${escapeHtml(userCode)}</p>
    <p>Keep this code safe. You'll need it if you ever contact Tea Time Cari Support.
       Our systems are highly encrypted; never share your account code with anyone
       except the Tea Time Cari support team.</p>
    <p><em>Next up:</em> a Welcome email from the Tea Time Cari Community should land in your inbox in ~2 minutes with the login link.</p>
    <p>— Tea Time Cari Team</p>
  </div>`;
}
function htmlWelcome(username: string) {
  const loginUrl = `${DISCOURSE_BASE}/login`;
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;color:#111">
    <p>Hi <strong>${escapeHtml(username)}</strong>,</p>
    <p>Your Tea Time Cari Community account is ready.</p>
    <p><strong>Log in here:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
    <p>Use the same email and password you set during signup in the app.</p>
    <p>If you have trouble signing in, click "Forgot password" on the login page.
       You may also contact us via <a href="mailto:hello@teatimecari.app">hello@teatimecari.app</a>.
       Remember to include your user code when contacting our support.</p>
    <p>— Tea Time Cari Team</p>
  </div>`;
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]
  );
}

/* ---------------- Handler ---------------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  const headers = cors(req);
  if (req.method !== "POST") return jerr(headers, 405, "Method not allowed");

  try {
    const body = await req.json().catch(() => ({}));
    const registrationId = body.registration_id ?? body.user_id;
    if (!registrationId) return jerr(headers, 400, "registration_id (or user_id) is required");

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    // auth + admin check
    const { data: auth } = await supa.auth.getUser();
    if (!auth?.user) return jerr(headers, 401, "Unauthorized");
    const { data: me, error: meErr } = await supa
      .from("profiles").select("id,is_admin").eq("id", auth.user.id).single();
    if (meErr || !me?.is_admin) return jerr(headers, 403, "Forbidden: admin only");

    // registration row
    const { data: reg, error: regErr } = await supa
      .from("registrations")
      .select("id,email,username,gender,password_temp,status,user_code,email_code")
      .eq("id", registrationId).single();
    if (regErr || !reg) return jerr(headers, 404, "Registration not found");

    const username = String(reg.username || "").trim();
    const email    = String(reg.email || "").trim();
    let password   = String(reg.password_temp || body.password || "").trim();
    const gender   = String(reg.gender || "").toLowerCase();

    if (!username || !email) return jerr(headers, 400, "username and email are required");
    if (!["male","female"].includes(gender)) return jerr(headers, 400, "gender must be 'male' or 'female'");
    if (!password) password = strongTempPassword();

    const groupId = gender === "male" ? GROUP_MALE_ID : GROUP_FEMALE_ID;
    if (!groupId) return jerr(headers, 500, "Group ID not configured (MEN_GROUP/WOMEN_GROUP)");

    // 1) Create user in Discourse (same password)
    const created = await createUserLenient(username, email, username, password);

    // 2) Resolve numeric user id regardless of "exists" case
    let discourseUserId = Number(created?.json?.user?.id ?? created?.json?.user_id ?? NaN);
    if (!discourseUserId || Number.isNaN(discourseUserId)) {
      discourseUserId = await getDiscourseUserId(username, email);
    }

    // 3) Add to gender group
    await addUserIdToGroup(groupId, discourseUserId);

    // 4) Ensure we have a user code, store it if needed
    let userCode = String(reg.user_code || reg.email_code || "").trim();
    if (!userCode) {
      userCode = makeUserCode("SLU");
      try {
        await supa.from("registrations")
          .update({ user_code: userCode, email_code: userCode })
          .eq("id", reg.id);
      } catch { /* ignore if some column missing */ }
    }

    // 5) Send the two emails via SendGrid (non-blocking for approval)
    let send1: any = { skipped: true }, send2: any = { skipped: true };
    try { send1 = await sendWithSendGrid(email,
      "Your Account is Approved — Save Your User Code",
      htmlApproved(username, userCode)); } catch (e: any) { console.warn("approval email failed:", e?.message); }
    try { send2 = await sendWithSendGrid(email,
      "Welcome to Tea Time Cari Community",
      htmlWelcome(username)); } catch (e: any) { console.warn("welcome email failed:", e?.message); }

    // 6) Mark approved and scrub temp password
    await supa.from("registrations").update({
      status: "approved", password_temp: null, updated_at: new Date().toISOString()
    }).eq("id", reg.id);
    try {
      await supa.from("registrations").update({
        discourse_user_id: discourseUserId, discourse_username: username
      }).eq("id", reg.id);
    } catch { /* optional columns */ }

    return new Response(JSON.stringify({
      ok: true,
      registration_id: reg.id,
      discourse: {
        created: created.created,
        create_status: created.status,
        create_reason: created.reason ?? null,
        user_id: discourseUserId,
        username,
        group_id: groupId,
      },
      emails: { approved: send1, welcome: send2 },
    }), { status: 200, headers });
  } catch (e: any) {
    console.error("approve-and-sync error:", e?.message, e?.stack);
    return jerr(headers, 500, e?.message ?? "Unknown error");
  }
});