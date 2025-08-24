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
function ok(headers: HeadersInit, body: any) {
  return new Response(JSON.stringify(body), { status: 200, headers });
}
function safeJson(s: string) { try { return JSON.parse(s); } catch { return { raw: s }; } }
function strongTempPassword(len = 14) {
  const dict = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789!@#$%^&*()_+-=";
  let out = "";
  crypto.getRandomValues(new Uint32Array(len)).forEach(n => out += dict[n % dict.length]);
  if (!/[A-Z]/.test(out)) out = "A" + out.slice(1);
  if (!/[a-z]/.test(out)) out = out.slice(0,1) + "a" + out.slice(2);
  if (!/[0-9]/.test(out)) out = out.slice(0,2) + "7" + out.slice(3);
  return out;
}
function makeUserCode(existing?: string | null) {
  if (existing && existing.trim()) return existing.trim();
  const n = Math.floor(100000 + Math.random()*900000);
  return `SLU${n}`;
}

/* ---------------- ENV ---------------- */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DISCOURSE_BASE = (Deno.env.get("DISCOURSE_BASE_URL") || "").replace(/\/+$/, "");
const DISCOURSE_KEY  = Deno.env.get("DISCOURSE_ADMIN_API_KEY")!;
const DISCOURSE_USER = Deno.env.get("DISCOURSE_ADMIN_API_USERNAME")!;
const REQUIRED_USER_FIELD_ID = Number(Deno.env.get("DISCOURSE_REQUIRED_USER_FIELD_ID") || "0");

// Numeric group IDs already in your secrets
const GROUP_MALE_ID   = Number(Deno.env.get("MEN_GROUP")   || "0");
const GROUP_FEMALE_ID = Number(Deno.env.get("WOMEN_GROUP") || "0");

// SendGrid
const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY") || "";
const FROM_EMAIL       = Deno.env.get("FROM_EMAIL")       || "";

/* ---------------- Discourse calls ---------------- */
async function createUserLenient(name: string, email: string, username: string, password: string) {
  const payload: any = {
    name,
    email,
    username,
    password,
    active: true,
    approved: true,
    send_welcome_message: false, // we send our own
  };
  if (REQUIRED_USER_FIELD_ID) {
    payload.user_fields = { [REQUIRED_USER_FIELD_ID]: username };
  }

  const res = await fetch(`${DISCOURSE_BASE}/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": DISCOURSE_KEY,
      "Api-Username": DISCOURSE_USER,
      "Accept": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  const json = safeJson(text);

  if (res.ok) return { created: true, status: res.status, json };

  // If it's "already exists" or similar, don't treat as fatal
  if (res.status === 409 || res.status === 422) {
    const t = typeof text === "string" ? text : JSON.stringify(json);
    const already = /already been taken|not available|has already|taken/i.test(t);
    if (already) return { created: false, status: res.status, reason: "exists", json };
  }

  throw new Error(`Discourse create failed: ${res.status} ${text}`);
}

async function getDiscourseUserId(username: string, email: string) {
  // by username
  {
    const r = await fetch(`${DISCOURSE_BASE}/u/${encodeURIComponent(username)}.json`, {
      headers: { "Api-Key": DISCOURSE_KEY, "Api-Username": DISCOURSE_USER, "Accept": "application/json" },
    });
    if (r.ok) {
      const j = await r.json().catch(()=>({}));
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
      const j = await r.json().catch(()=>({}));
      const id = j?.user?.id ?? j?.user_id;
      if (id) return Number(id);
    }
  }
  throw new Error(`Lookup user '${username}' failed (not found by username or email)`);
}

async function addUserIdToGroup(groupId: number, userId: number) {
  const form = new URLSearchParams();
  form.set("user_id", String(userId));
  const res = await fetch(`${DISCOURSE_BASE}/admin/groups/${groupId}/members.json`, {
    method: "PUT",
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
    // If already in group, treat as success
    if (/already/i.test(text)) return { ok: true, raw: safeJson(text) };
    throw new Error(`Add-to-group failed: ${res.status} ${text}`);
  }
  return safeJson(text);
}

/* ---------------- SendGrid emails ---------------- */
async function sendWithSendgrid(to: string, subject: string, html: string, text: string) {
  if (!SENDGRID_API_KEY || !FROM_EMAIL) {
    console.warn("Email skipped: missing SENDGRID_API_KEY or FROM_EMAIL");
    return { sent: false, skipped: true, reason: "missing_sendgrid_or_from" };
  }
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: FROM_EMAIL, name: "Tea Time Cari" },
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
    <p><em>Next up:</em> a Welcome email from the Tea Time Cari Community should land in your inbox in ~2 minutes with the login link.</p>
    <p>— Tea Time Cari Team</p>
  `;
  const text =
`Hi ${username},

Great News — Your Account is Approved!

User Code: ${userCode}
Keep this code safe. You’ll need it if you ever contact Tea Time Cari Support.
Our systems are highly encrypted; never share your account code with anyone except the Tea Time Cari support team.

Next up: a Welcome email from the Tea Time Cari Community should land in your inbox in ~2 minutes with the login link.

— Tea Time Cari Team`;
  return { subject, html, text };
}

function tplWelcome(username: string) {
  const subject = "Welcome to Tea Time Cari Community";
  const loginUrl = `${DISCOURSE_BASE}/login`;
  const html = `
    <p>Hi <strong>${username}</strong>,</p>
    <p>Your Tea Time Cari Community account is ready.</p>
    <p><strong>Log in here:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
    <p>Use the same email and password you set during signup in the app.</p>
    <p>If you have trouble signing in, click “Forgot password” on the login page.
    You may also contact us at <a href="mailto:hello@teatimecari.app">hello@teatimecari.app</a>. Remember to include your user code when contacting support.</p>
    <p>— Tea Time Cari Team</p>
  `;
  const text =
`Hi ${username},

Your Tea Time Cari Community account is ready.

Log in here: ${loginUrl}

Use the same email and password you set during signup in the app.

If you have trouble signing in, click “Forgot password” on the login page.
You may also contact us at hello@teatimecari.app. Remember to include your user code when contacting support.

— Tea Time Cari Team`;
  return { subject, html, text };
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

    // Supabase client with caller JWT for admin check
    const supa = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    // must be an authenticated admin
    const { data: auth } = await supa.auth.getUser();
    if (!auth?.user) return jerr(headers, 401, "Unauthorized");
    const { data: me, error: meErr } = await supa
      .from("profiles").select("id, is_admin").eq("id", auth.user.id).single();
    if (meErr || !me?.is_admin) return jerr(headers, 403, "Forbidden: admin only");

    // load registration
    const { data: reg, error: regErr } = await supa
      .from("registrations")
      .select("id, email, username, gender, password_temp, status, email_code, email_code_expiry")
      .eq("id", registrationId)
      .single();
    if (regErr || !reg) return jerr(headers, 404, "Registration not found");

    const username = String(reg.username || "").trim();
    const email    = String(reg.email || "").trim();
    let password   = String(reg.password_temp || body.password || "").trim(); // fallback from body
    const gender   = String(reg.gender || "").toLowerCase();

    if (!username || !email) return jerr(headers, 400, "username and email are required");
    if (!["male","female"].includes(gender)) return jerr(headers, 400, "gender must be 'male' or 'female'");
    if (!password) password = strongTempPassword(); // last resort

    const groupId = gender === "male" ? GROUP_MALE_ID : GROUP_FEMALE_ID;
    if (!groupId) return jerr(headers, 500, "Group ID not configured (MEN_GROUP/WOMEN_GROUP)");

    // ensure user code (rebranded) exists
    const userCode = makeUserCode(reg.email_code);
    const expiry = reg.email_code_expiry ?? new Date(Date.now()+24*60*60*1000).toISOString();
    if (!reg.email_code) {
      await supa.from("registrations")
        .update({ email_code: userCode, email_code_expiry: expiry })
        .eq("id", reg.id);
    }

    // 1) Create or accept existing Discourse user
    const created = await createUserLenient(username, email, username, password);

    // 2) Get numeric user id either from create or by lookup
    let discourseUserId = Number(created?.json?.user?.id ?? created?.json?.user_id ?? NaN);
    if (!discourseUserId || Number.isNaN(discourseUserId)) {
      discourseUserId = await getDiscourseUserId(username, email);
    }

    // 3) Add to group
    await addUserIdToGroup(groupId, discourseUserId);

    // 4) Send the two emails (non-fatal if they fail)
    const e1tpl = tplApproved(username, userCode);
    const e2tpl = tplWelcome(username);

    const emailApproved = await sendWithSendgrid(email, e1tpl.subject, e1tpl.html, e1tpl.text).catch(err => ({ sent:false, error: String(err) }));
    const emailWelcome  = await sendWithSendgrid(email, e2tpl.subject, e2tpl.html, e2tpl.text).catch(err => ({ sent:false, error: String(err) }));

    // 5) Mark approved; scrub temp password
    await supa.from("registrations")
      .update({ status: "approved", password_temp: null, updated_at: new Date().toISOString() })
      .eq("id", reg.id);
    try {
      await supa.from("registrations")
        .update({ discourse_user_id: discourseUserId, discourse_username: username })
        .eq("id", reg.id);
    } catch {}

    return ok(headers, {
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
      emails: {
        approved: emailApproved,
        welcome:  emailWelcome,
      },
    });
  } catch (e: any) {
    console.error("approve-and-sync error:", e?.message, e?.stack);
    return jerr(headers, 500, e?.message ?? "Unknown error");
  }
});
