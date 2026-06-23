// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { buildDiscourseGroups, hmacHex } from "../_shared/sso.ts";
import { requireAdmin, writeAdminAuditLog } from "../_shared/adminAuth.ts";

type GenderDisplay = "Male" | "Female";
type GenderNorm = "men" | "women";

type UpdateUserRequest = {
  registration_id?: string;
  user_id?: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
};

const DISCOURSE_BASE = (Deno.env.get("DISCOURSE_BASE_URL") || "https://community.teatimecari.app").replace(/\/+$/, "");
const DISCOURSE_KEY = Deno.env.get("DISCOURSE_ADMIN_API_KEY") || "";
const DISCOURSE_USER = Deno.env.get("DISCOURSE_ADMIN_API_USERNAME") || "system";
const DISCOURSE_SSO_SECRET = Deno.env.get("DISCOURSE_SSO_SECRET") || "";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function fieldValue<T>(body: Record<string, unknown>, field: string, fallback: T): string | null | T {
  return Object.prototype.hasOwnProperty.call(body, field)
    ? cleanText(body[field]) ?? null
    : fallback;
}

function normalizeGender(value: unknown): { display: GenderDisplay; norm: GenderNorm } | null {
  const v = String(value ?? "").trim().toLowerCase();
  if (["male", "men", "m"].includes(v)) return { display: "Male", norm: "men" };
  if (["female", "women", "woman", "f"].includes(v)) return { display: "Female", norm: "women" };
  return null;
}

function nameFrom(input: { firstName?: string | null; lastName?: string | null; username?: string | null }) {
  const parts = [input.firstName, input.lastName].map((part) => part?.trim()).filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : input.username?.trim() || "";
}


type AvailabilityConflict = {
  field: "email" | "username";
  value: string;
  message: string;
  suggestions?: string[];
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function generateUsernameSuggestions(baseUsername: string) {
  const cleanBase = baseUsername.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 17) || "teatime";
  const suffixes = ["_new", "_cari", "_tt", new Date().getFullYear().toString().slice(-2)];
  const suggestions = suffixes
    .map((suffix) => `${cleanBase}${suffix}`)
    .filter((suggestion) => suggestion.length <= 20);

  while (suggestions.length < 5) {
    const next = `${cleanBase.slice(0, 17)}${Math.floor(Math.random() * 900) + 100}`;
    if (next.length <= 20 && !suggestions.includes(next)) suggestions.push(next);
  }

  return suggestions.slice(0, 5);
}

async function hasDuplicate(table: "registrations" | "profiles", field: "email" | "username", value: string, registrationId: string) {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select("id")
    .ilike(field, value)
    .neq("id", registrationId)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01" || error.code === "42703" || error.code === "PGRST116") return false;
    throw error;
  }

  return Boolean(data);
}

async function findAvailabilityConflicts(input: {
  registrationId: string;
  email: string;
  username: string;
  currentEmail?: string | null;
  currentUsername?: string | null;
}) {
  const conflicts: AvailabilityConflict[] = [];
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedCurrentEmail = normalizeEmail(input.currentEmail || "");
  const normalizedUsername = normalizeUsername(input.username);
  const normalizedCurrentUsername = normalizeUsername(input.currentUsername || "");

  if (normalizedEmail !== normalizedCurrentEmail) {
    const emailExists = await hasDuplicate("registrations", "email", normalizedEmail, input.registrationId) ||
      await hasDuplicate("profiles", "email", normalizedEmail, input.registrationId);

    if (emailExists) {
      conflicts.push({
        field: "email",
        value: input.email,
        message: "That email address is already in the database. Please use a different email address.",
      });
    }
  }

  if (normalizedUsername !== normalizedCurrentUsername) {
    const usernameExists = await hasDuplicate("registrations", "username", normalizedUsername, input.registrationId) ||
      await hasDuplicate("profiles", "username", normalizedUsername, input.registrationId);

    if (usernameExists) {
      conflicts.push({
        field: "username",
        value: input.username,
        message: "That username is already in the database. Please choose a different username.",
        suggestions: generateUsernameSuggestions(input.username),
      });
    }
  }

  return conflicts;
}

function genderGroups() {
  return {
    men: Deno.env.get("MEN_GROUP") || "men-slu",
    women: Deno.env.get("WOMEN_GROUP") || "women-slu",
  };
}

function missingDiscourseConfig() {
  return [
    ["DISCOURSE_BASE_URL", DISCOURSE_BASE],
    ["DISCOURSE_ADMIN_API_KEY", DISCOURSE_KEY],
    ["DISCOURSE_ADMIN_API_USERNAME", DISCOURSE_USER],
    ["DISCOURSE_SSO_SECRET", DISCOURSE_SSO_SECRET],
  ].filter(([, value]) => !value).map(([key]) => key);
}

async function syncDiscourseUser(input: {
  id: string;
  email: string;
  username: string;
  name: string;
  nextGender: GenderNorm;
  previousGender: GenderNorm | null;
  xaccess: boolean;
}) {
  const missing = missingDiscourseConfig();
  if (missing.length > 0) {
    return {
      success: false,
      skipped: true,
      reason: "missing_config",
      missing_config: missing,
      message: `Discourse sync skipped; missing ${missing.join(", ")}.`,
    };
  }

  const groups = genderGroups();
  const addGroups = buildDiscourseGroups(input.nextGender, input.xaccess);
  const removeGroups = input.previousGender && input.previousGender !== input.nextGender
    ? groups[input.previousGender]
    : "";

  const payload: Record<string, string> = {
    external_id: input.id,
    email: input.email,
    username: input.username,
    name: input.name || input.username,
    add_groups: addGroups,
  };

  if (removeGroups) payload.remove_groups = removeGroups;

  const qs = new URLSearchParams(payload).toString();
  const b64 = btoa(qs);
  const sig = await hmacHex(b64, DISCOURSE_SSO_SECRET);
  const form = new URLSearchParams({ sso: b64, sig });

  const response = await fetch(`${DISCOURSE_BASE}/admin/users/sync_sso`, {
    signal: AbortSignal.timeout(8000),
    method: "POST",
    headers: {
      "Api-Key": DISCOURSE_KEY,
      "Api-Username": DISCOURSE_USER,
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: form.toString(),
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`Discourse sync_sso failed: ${response.status} ${text}`);

  return {
    success: true,
    skipped: false,
    add_groups: addGroups,
    remove_groups: removeGroups || null,
    result: (() => {
      try { return JSON.parse(text); } catch { return { raw: text }; }
    })(),
  };
}

async function maybeGetProfile(registrationId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, gender, xaccess")
    .eq("id", registrationId)
    .maybeSingle();

  if (error && error.code !== "42P01") console.warn("profiles lookup failed", error);
  return error ? null : data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  let actor: Awaited<ReturnType<typeof requireAdmin>>["actor"] = null;
  try {
    const adminCheck = await requireAdmin(req, "admin:access");
    if (!adminCheck.actor) return json(adminCheck.status, { ok: false, error: adminCheck.error });
    actor = adminCheck.actor;
    if (actor.role !== "owner") return json(403, { ok: false, error: "Forbidden: owner only" });

    const body = (await req.json().catch(() => ({}))) as UpdateUserRequest;
    const registrationId = body.registration_id || body.user_id;
    if (!registrationId) return json(400, { ok: false, error: "registration_id is required" });

    const { data: current, error: lookupError } = await supabaseAdmin
      .from("registrations")
      .select("id, email, phone, username, firstName, lastName, gender, status")
      .eq("id", registrationId)
      .maybeSingle();

    if (lookupError) return json(500, { ok: false, error: "registration lookup failed", detail: lookupError.message });
    if (!current) return json(404, { ok: false, error: "Registration not found" });

    const nextGender = normalizeGender(body.gender ?? current.gender);
    if (!nextGender) return json(400, { ok: false, error: "gender must be Male or Female" });

    const bodyRecord = body as Record<string, unknown>;
    const next = {
      firstName: fieldValue(bodyRecord, "firstName", current.firstName ?? null),
      lastName: fieldValue(bodyRecord, "lastName", current.lastName ?? null),
      username: fieldValue(bodyRecord, "username", current.username ?? null),
      email: fieldValue(bodyRecord, "email", current.email ?? null),
      phone: fieldValue(bodyRecord, "phone", current.phone ?? null),
      gender: nextGender.display,
    };

    if (!next.email) return json(400, { ok: false, error: "email is required" });
    if (!next.username) return json(400, { ok: false, error: "username is required" });

    const conflicts = await findAvailabilityConflicts({
      registrationId,
      email: next.email,
      username: next.username,
      currentEmail: current.email,
      currentUsername: current.username,
    });
    if (conflicts.length > 0) {
      return json(409, {
        ok: false,
        error: "availability_conflict",
        message: conflicts.map((conflict) => conflict.message).join(" "),
        conflicts,
      });
    }

    const previousGender = normalizeGender(current.gender)?.norm ?? null;
    const profile = await maybeGetProfile(registrationId);
    const xaccess = Boolean(profile?.xaccess);

    const { error: regUpdateError } = await supabaseAdmin
      .from("registrations")
      .update(next)
      .eq("id", registrationId);

    if (regUpdateError) return json(500, { ok: false, error: "registration update failed", detail: regUpdateError.message });

    let authEmailWarning: string | null = null;
    if (next.email !== current.email) {
      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(registrationId, { email: next.email });
      if (authUpdateError) {
        authEmailWarning = authUpdateError.message;
        console.warn("auth email sync failed", authUpdateError);
      }
    }

    const fullName = nameFrom(next);
    const { error: profileUpsertError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: registrationId,
          email: next.email,
          username: next.username,
          full_name: fullName || next.username,
          gender: nextGender.norm,
          xaccess,
          kyc_status: current.status === "rejected" ? "rejected" : current.status === "pending" ? "pending" : "approved",
          approved_at: ["approved", "verified"].includes(String(current.status)) ? new Date().toISOString() : null,
        },
        { onConflict: "id" },
      );
    if (profileUpsertError && profileUpsertError.code !== "42P01") console.warn("profile sync failed", profileUpsertError);

    const [{ error: postsError }, { error: commentsError }] = await Promise.all([
      supabaseAdmin.from("posts").update({ username: next.username, gender: next.gender }).eq("user_id", registrationId),
      supabaseAdmin.from("comments").update({ username: next.username, gender: next.gender }).eq("user_id", registrationId),
    ]);
    if (postsError && postsError.code !== "42P01") console.warn("post ownership sync failed", postsError);
    if (commentsError && commentsError.code !== "42P01") console.warn("comment ownership sync failed", commentsError);

    const discourse = await syncDiscourseUser({
      id: registrationId,
      email: next.email,
      username: next.username,
      name: fullName || next.username,
      nextGender: nextGender.norm,
      previousGender,
      xaccess,
    }).catch((error) => ({ success: false, skipped: false, reason: "sync_error", error: String(error?.message ?? error) }));

    await writeAdminAuditLog({
      actor,
      req,
      action: "user_profile_updated",
      targetType: "registration",
      targetId: registrationId,
      targetEmail: next.email,
      previousStatus: String(current.status || ""),
      nextStatus: String(current.status || ""),
      metadata: {
        previous: {
          email: current.email,
          phone: current.phone,
          username: current.username,
          firstName: current.firstName,
          lastName: current.lastName,
          gender: current.gender,
        },
        next,
        discourse,
        auth_email_warning: authEmailWarning,
        synced_tables: ["registrations", "profiles", "posts", "comments", "auth.users"],
      },
      success: true,
      errorMessage: (discourse as { success?: boolean; error?: string }).success === false
        ? ((discourse as { error?: string }).error ?? "Discourse sync failed")
        : null,
    });

    return json(200, {
      ok: true,
      registration_id: registrationId,
      user: { ...current, ...next, fullName },
      discourse,
      warnings: {
        auth_email: authEmailWarning,
        profile: profileUpsertError && profileUpsertError.code !== "42P01" ? profileUpsertError.message : null,
        posts: postsError && postsError.code !== "42P01" ? postsError.message : null,
        comments: commentsError && commentsError.code !== "42P01" ? commentsError.message : null,
      },
    });
  } catch (error) {
    console.error("admin-update-user-profile error", error);
    await writeAdminAuditLog({
      actor,
      req,
      action: "user_profile_update_failed",
      targetType: "registration",
      success: false,
      errorMessage: String(error),
    });
    return json(500, { ok: false, error: "internal", detail: String(error) });
  }
});
