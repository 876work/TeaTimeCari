// deno-lint-ignore-file no-explicit-any
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendApprovalEmail } from "../_shared/resendEmail.ts";
import { buildDiscourseGroups } from "../_shared/sso.ts";
import { requireAdmin, writeAdminAuditLog } from "../_shared/adminAuth.ts";

/* ---------------- CORS helpers ---------------- */
function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") || "*")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

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

function safeJson(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return { raw: s };
  }
}

/* ---------------- Env ---------------- */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const DEFAULT_DISCOURSE_BASE_URL = "https://community.teatimecari.app";
const DISCOURSE_BASE = (Deno.env.get("DISCOURSE_BASE_URL") || DEFAULT_DISCOURSE_BASE_URL).replace(/\/+$/, "");
const DISCOURSE_KEY = Deno.env.get("DISCOURSE_ADMIN_API_KEY") || "";
const DISCOURSE_USER = Deno.env.get("DISCOURSE_ADMIN_API_USERNAME") || "system";
const DISCOURSE_SSO_SECRET = Deno.env.get("DISCOURSE_SSO_SECRET") || "";
const SEND_ACTIVATION = (Deno.env.get("SEND_DISCOURSE_ACTIVATION") || "false").toLowerCase() === "true";

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

  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

  return (reg?.username ?? "").toString().trim();
}

/* ---------------- Discourse SSO sync ---------------- */
function missingDiscourseAdminSyncConfig() {
  const missing: string[] = [];

  if (!DISCOURSE_BASE) missing.push("DISCOURSE_BASE_URL");
  if (!DISCOURSE_KEY) missing.push("DISCOURSE_ADMIN_API_KEY");
  if (!DISCOURSE_USER) missing.push("DISCOURSE_ADMIN_API_USERNAME");
  if (!DISCOURSE_SSO_SECRET) missing.push("DISCOURSE_SSO_SECRET");

  return missing;
}

async function discourseSyncSSO(payload: Record<string, string>) {
  const missingConfig = missingDiscourseAdminSyncConfig();

  if (missingConfig.length > 0) {
    return {
      success: false,
      skipped: true,
      reason: "missing_config",
      missing_config: missingConfig,
      message: `Discourse pre-sync skipped; missing ${missingConfig.join(", ")}.`,
    };
  }

  const qs = new URLSearchParams(payload).toString();
  const b64 = btoa(qs);
  const sig = await hmacHex(b64, DISCOURSE_SSO_SECRET);

  const form = new URLSearchParams();
  form.set("sso", b64);
  form.set("sig", sig);

  if (SEND_ACTIVATION) {
    form.set("require_activation", "true");
  }

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

  return {
    success: true,
    skipped: false,
    result: safeJson(text),
  };
}


async function sendDiscourseWelcomePM(targetUsername: string) {
  const missingConfig = missingDiscourseAdminSyncConfig();

  if (missingConfig.length > 0) {
    return {
      success: false,
      skipped: true,
      reason: "missing_config",
      missing_config: missingConfig,
      message: `Discourse welcome PM skipped; missing ${missingConfig.join(", ")}.`,
    };
  }

  const username = targetUsername.trim();

  if (!username) {
    return { success: false, skipped: true, reason: "missing_username" };
  }

  const form = new URLSearchParams();
  form.set("title", "Welcome to Tea Time Cari");
  form.set("target_usernames", username);
  form.set("archetype", "private_message");
  form.set("raw", [
    "Welcome to Tea Time Cari — your account has been approved.",
    "",
    "Before you post or reply, please keep these safety basics in mind:",
    "",
    "1. Share only what you personally know or can reasonably support.",
    "2. Protect privacy. Do not expose addresses, workplaces, IDs, private messages, or unnecessary personal details.",
    "3. Keep the tone respectful and safety-focused. No harassment, threats, pile-ons, or revenge posting.",
    "",
    "Use your assigned private category first. If something feels unsafe, use the flag/report option and include a clear reason so moderators can review it.",
  ].join("\n"));

  const res = await fetch(`${DISCOURSE_BASE}/posts.json`, {
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
    throw new Error(`Discourse welcome PM failed: ${res.status} ${text}`);
  }

  return {
    success: true,
    skipped: false,
    result: safeJson(text),
  };
}

async function approveRegistrationRecord(supa: any, reg: any, genderNorm: "men" | "women") {
  const approvedAt = new Date().toISOString();

  const { error: regUpdateErr } = await supa
    .from("registrations")
    .update({ status: "approved" })
    .eq("id", reg.id);

  if (regUpdateErr) {
    throw new Error(`Failed to approve registration: ${regUpdateErr.message}`);
  }

  // Keep the newer profiles table in sync when it exists. Some deployments only
  // use registrations for KYC gating, so profile sync is intentionally best-effort.
  const { error: profileErr } = await supa
    .from("profiles")
    .upsert(
      {
        id: reg.id,
        email: reg.email,
        username: reg.username,
        full_name: nameFrom(reg) || reg.username,
        gender: genderNorm,
        kyc_status: "approved",
        approved_at: approvedAt,
      },
      { onConflict: "id" },
    );

  if (profileErr && profileErr.code !== "42P01") {
    console.warn("profiles sync failed after registration approval", profileErr);
  }
}

/* ---------------- Handler ---------------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(req) });
  }

  const headers = cors(req);

  if (req.method !== "POST") {
    return jerr(headers, 405, "Method not allowed");
  }

  try {
    const body = await req.json().catch(() => ({} as any));
    const registrationId: string | undefined = body.registration_id ?? body.user_id;

    if (!registrationId) {
      return jerr(headers, 400, "registration_id (or user_id) is required");
    }

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return jerr(headers, 500, "Supabase service configuration is missing");
    }

    const adminCheck = await requireAdmin(req, "users:approve");
    if (!adminCheck.actor) return jerr(headers, adminCheck.status, adminCheck.error);
    const actor = adminCheck.actor;

    // Use a service-role client without forwarding the caller Authorization header
    // so approval can bypass RLS while still being called from the admin UI.
    const supa = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const action = String(body.action ?? "approve");
    if (action !== "approve" && action !== "retry_discourse_sync") {
      return jerr(headers, 400, "action must be approve or retry_discourse_sync");
    }

    // Optionally allow gender/xaccess from body; otherwise read from DB
    const bodyGender = normalizeGender(String(body.gender ?? ""));
    const xaccessFlag = Boolean(body.xaccess ?? false);

    // Load registration
    const { data: reg, error: regErr } = await supa
      .from("registrations")
      .select("id, email, username, firstName, lastName, gender, status, email_code, email_code_expiry, discourse_welcome_pm_sent_at")
      .eq("id", registrationId)
      .single();

    if (regErr || !reg) {
      console.error("registrations lookup failed", { registrationId, regErr });
      return jerr(headers, 404, "Registration not found");
    }

    const username = String(reg.username || "").trim();
    const email = String(reg.email || "").trim();

    if (!username || !email) {
      return jerr(headers, 400, "username and email are required");
    }

    const genderNorm = bodyGender || normalizeGender(String(reg.gender || ""));

    if (!genderNorm) {
      return jerr(headers, 400, "gender must be 'men' or 'women'");
    }

    // Build SSO groups through the shared helper so approval-time sync matches login-time SSO.
    const groups = buildDiscourseGroups(genderNorm, xaccessFlag);

    if (action === "approve") {
      // 1) Approve in Supabase first. External integrations below are non-fatal so
      // a Discourse or email outage cannot leave an approved applicant pending.
      await approveRegistrationRecord(supa, reg, genderNorm);
    } else if (reg.status !== "approved") {
      return jerr(headers, 400, "Only approved registrations can retry Discourse sync");
    }

    // 2) Sync to Discourse via SSO. This is non-fatal for approval.
    // Do not sync legal/full names into Discourse display fields; the public
    // community identity is the member-selected username.

    // Keep external_id stable forever: DiscourseConnect associates users by this value.
    const discourse = await discourseSyncSSO({
      external_id: reg.id,
      email,
      username,
      name: username,
      add_groups: groups,
    }).catch((err) => ({
      success: false,
      skipped: false,
      reason: "sync_error",
      error: String(err?.message ?? err),
    }));

    // 3) Send one approval email via Resend. This is non-fatal if it fails. Do not
    // resend approval email during a Discourse retry.
    const emailApproved = action === "approve"
      ? await sendApprovalEmail(email, String(reg.firstName || "").trim() || undefined)
        .catch((err) => ({
          success: false,
          error: String(err),
        }))
      : { success: true, skipped: true, reason: "retry_discourse_sync" };

    const welcomePm = action === "approve" && discourse.success && !reg.discourse_welcome_pm_sent_at
      ? await sendDiscourseWelcomePM(username)
        .catch((err) => ({
          success: false,
          skipped: false,
          reason: "pm_error",
          error: String(err?.message ?? err),
        }))
      : {
        success: true,
        skipped: true,
        reason: action === "approve" ? "already_sent_or_sync_failed" : "retry_discourse_sync",
      };

    if (action === "approve" && welcomePm.success && !welcomePm.skipped) {
      const { error: welcomePmUpdateErr } = await supa
        .from("registrations")
        .update({ discourse_welcome_pm_sent_at: new Date().toISOString() })
        .eq("id", reg.id);

      if (welcomePmUpdateErr) {
        console.warn("failed to record Discourse welcome PM timestamp", welcomePmUpdateErr);
      }
    }

    const discourseOk = Boolean(discourse.success);
    const emailOk = Boolean(emailApproved.success);
    const resultStatus = action === "retry_discourse_sync"
      ? (discourseOk ? "discourse_sync_retried" : "discourse_sync_retry_failed")
      : !discourseOk
        ? "approved_with_sync_error"
        : !emailOk
          ? "approved_with_email_error"
          : "approved";

    await writeAdminAuditLog({
      actor,
      req,
      action: action === "retry_discourse_sync" ? "discourse_sync_retried" : "user_approved",
      targetType: "registration",
      targetId: reg.id,
      targetEmail: email,
      previousStatus: String(reg.status || "pending"),
      nextStatus: action === "approve" ? "approved" : String(reg.status || "approved"),
      metadata: { discourse, email: emailApproved, welcome_pm: welcomePm, groups, resultStatus },
      success: action === "retry_discourse_sync" ? discourseOk : true,
      errorMessage: discourseOk ? null : String((discourse as { error?: unknown }).error ?? "Discourse sync failed"),
    });

    return ok(headers, {
      ok: true,
      status: resultStatus,
      registration_id: reg.id,
      discourse: {
        synced_via_sso: discourse.success,
        add_groups: groups,
        ...discourse,
      },
      emails: {
        approved: emailApproved,
      },
      welcome_pm: welcomePm,
    });
  } catch (e: unknown) {
    const err = e as { message?: string; stack?: string };
    console.error("approve-and-sync error:", err?.message, err?.stack);

    return jerr(headers, 500, err?.message ?? "Unknown error");
  }
});