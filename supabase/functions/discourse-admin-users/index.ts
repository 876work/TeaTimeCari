import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

type Action = "list" | "promote" | "demote";
type UserFlag = "all" | "active" | "staff" | "suspended" | "new" | "blocked" | "suspect";

type RequestBody = {
  action?: Action;
  flag?: UserFlag;
  page?: number;
  search?: string;
  discourse_user_id?: number | string;
};

type DiscourseUser = {
  id: number;
  username?: string | null;
  name?: string | null;
  email?: string | null;
  active?: boolean | null;
  admin?: boolean | null;
  moderator?: boolean | null;
  staged?: boolean | null;
  suspended?: boolean | null;
  suspended_till?: string | null;
  created_at?: string | null;
  last_seen_at?: string | null;
  trust_level?: number | null;
  can_grant_admin?: boolean | null;
  can_revoke_admin?: boolean | null;
};

const DISCOURSE_BASE_URL = (Deno.env.get("DISCOURSE_BASE_URL") || "").replace(/\/+$/, "");
const DISCOURSE_ADMIN_API_KEY = Deno.env.get("DISCOURSE_ADMIN_API_KEY") || "";
const DISCOURSE_ADMIN_API_USERNAME = Deno.env.get("DISCOURSE_ADMIN_API_USERNAME") || "system";

const VALID_FLAGS = new Set<UserFlag>([
  "all",
  "active",
  "staff",
  "suspended",
  "new",
  "blocked",
  "suspect",
]);

const ALL_USER_FLAGS: UserFlag[] = [
  "active",
  "staff",
  "suspended",
  "new",
  "blocked",
  "suspect",
];

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);

  return match?.[1] || null;
}

function decodeJwtPayload(token: string) {
  const payload = token.split(".")[1];

  if (!payload) return null;

  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const parsed = JSON.parse(atob(padded)) as { email?: string | null };

    return parsed;
  } catch {
    return null;
  }
}

function normalizeEmail(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function hasAdminEmail(value?: string | null) {
  return normalizeEmail(value).includes("admin");
}

function getDiscourseHeaders() {
  return {
    "Api-Key": DISCOURSE_ADMIN_API_KEY,
    "Api-Username": DISCOURSE_ADMIN_API_USERNAME,
    "Accept": "application/json",
  };
}

function normalizeSearch(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function isSuspended(user: DiscourseUser) {
  if (typeof user.suspended === "boolean") return user.suspended;

  return Boolean(user.suspended_till);
}

function sanitizeUser(user: DiscourseUser) {
  return {
    id: user.id,
    username: user.username ?? null,
    name: user.name ?? null,
    email: user.email ?? null,
    active: Boolean(user.active),
    admin: Boolean(user.admin),
    moderator: Boolean(user.moderator),
    suspended: isSuspended(user),
    staged: Boolean(user.staged),
    created_at: user.created_at ?? null,
    last_seen_at: user.last_seen_at ?? null,
    trust_level: user.trust_level ?? null,
    can_grant_admin: Boolean(user.can_grant_admin),
    can_revoke_admin: Boolean(user.can_revoke_admin),
  };
}

function matchesSearch(user: DiscourseUser, search: string) {
  if (!search) return true;

  return [user.username, user.name, user.email]
    .map((value) => (value || "").toLowerCase())
    .some((value) => value.includes(search));
}

async function requireTeaTimeAdmin(req: Request) {
  const token = getBearerToken(req);

  if (!token) {
    return { error: json(401, { error: "Unauthorized" }) };
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !authData.user) {
    return { error: json(401, { error: "Unauthorized" }) };
  }

  const tokenPayload = decodeJwtPayload(token);

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("is_admin, email")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) {
    return { error: json(500, { error: "admin lookup failed" }) };
  }

  const adminEmailFallback = [
    authData.user.email,
    profile?.email,
    tokenPayload?.email,
  ].some(hasAdminEmail);

  if (!profile?.is_admin && !adminEmailFallback) {
    console.warn("Discourse admin access denied", {
      userId: authData.user.id,
      authEmail: normalizeEmail(authData.user.email),
      profileEmail: normalizeEmail(profile?.email),
      hasProfileAdminFlag: Boolean(profile?.is_admin),
      hasAdminEmailFallback: adminEmailFallback,
    });

    return { error: json(403, { error: "Forbidden: admin only" }) };
  }

  return { user: authData.user };
}

function assertDiscourseConfig() {
  const missing: string[] = [];

  if (!DISCOURSE_BASE_URL) missing.push("DISCOURSE_BASE_URL");
  if (!DISCOURSE_ADMIN_API_KEY) missing.push("DISCOURSE_ADMIN_API_KEY");
  if (!DISCOURSE_ADMIN_API_USERNAME) missing.push("DISCOURSE_ADMIN_API_USERNAME");

  if (missing.length > 0) {
    throw new Error(`Missing Discourse configuration: ${missing.join(", ")}`);
  }
}

async function discourseFetch(path: string, init: RequestInit = {}) {
  assertDiscourseConfig();

  const response = await fetch(`${DISCOURSE_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...getDiscourseHeaders(),
      ...(init.headers || {}),
    },
  });

  const text = await response.text();

  let body: unknown = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }

  if (!response.ok) {
    const message =
      typeof body === "object" && body && "errors" in body
        ? JSON.stringify((body as { errors: unknown }).errors)
        : text || response.statusText;

    throw new Error(`Discourse API failed (${response.status}): ${message}`);
  }

  return body;
}

async function getDiscourseUser(userId: number) {
  return (await discourseFetch(`/admin/users/${userId}.json`)) as DiscourseUser;
}

async function listUsersForFlag(flag: UserFlag, page: number, search: string) {
  const params = new URLSearchParams();

  params.set("page", String(page));
  params.set("show_emails", "true");

  if (search.includes("@")) {
    params.set("email", search);
  } else if (search) {
    params.set("filter", search);
  }

  const body = await discourseFetch(`/admin/users/list/${flag}.json?${params.toString()}`);
  const users = Array.isArray(body) ? (body as DiscourseUser[]) : [];

  return users.filter((user) => matchesSearch(user, search));
}

async function listDiscourseUsers(flag: UserFlag, page: number, search: string) {
  if (flag !== "all") {
    return await listUsersForFlag(flag, page, search);
  }

  /*
    Discourse does not reliably support an "all" flag for:
    /admin/users/list/{flag}.json

    Instead of calling /admin/users/list/all.json and causing the Edge Function
    to fail, build the all users view by merging the known supported flags.
  */
  const merged = new Map<number, DiscourseUser>();
  const errors: string[] = [];

  for (const userFlag of ALL_USER_FLAGS) {
    try {
      const users = await listUsersForFlag(userFlag, page, search);

      for (const user of users) {
        merged.set(user.id, { ...merged.get(user.id), ...user });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${userFlag}: ${message}`);
      console.warn(`Discourse ${userFlag} lookup failed`, error);
    }
  }

  if (merged.size === 0 && errors.length === ALL_USER_FLAGS.length) {
    throw new Error(`Unable to load Discourse users from any user list: ${errors.join(" | ")}`);
  }

  return Array.from(merged.values()).sort((a, b) => {
    const aName = (a.username || a.email || "").toLowerCase();
    const bName = (b.username || b.email || "").toLowerCase();

    return aName.localeCompare(bName);
  });
}

async function listStaffAdmins() {
  const admins: DiscourseUser[] = [];

  for (let page = 0; page < 20; page += 1) {
    const staff = await listUsersForFlag("staff", page, "");
    admins.push(...staff.filter((user) => Boolean(user.admin)));

    if (staff.length === 0) break;
  }

  return admins;
}

async function logAttempt(input: {
  actorUserId: string;
  actorEmail?: string | null;
  action: "promote" | "demote";
  targetDiscourseUserId: number;
  targetUsername?: string | null;
  targetEmail?: string | null;
  success: boolean;
  errorMessage?: string | null;
}) {
  const { error } = await supabaseAdmin
    .from("discourse_admin_audit_logs")
    .insert({
      actor_user_id: input.actorUserId,
      actor_email: input.actorEmail ?? null,
      action: input.action,
      target_discourse_user_id: input.targetDiscourseUserId,
      target_username: input.targetUsername ?? null,
      target_email: input.targetEmail ?? null,
      success: input.success,
      error_message: input.errorMessage ?? null,
    });

  if (error) {
    console.warn("Unable to write Discourse admin audit log", error);
  }
}

async function changeAdminStatus(
  action: "promote" | "demote",
  targetUserId: number,
  actor: { id: string; email?: string | null },
) {
  const before = await getDiscourseUser(targetUserId);
  const actorEmail = normalizeEmail(actor.email);
  const targetEmail = normalizeEmail(before.email);

  if (action === "demote" && actorEmail && targetEmail && actorEmail === targetEmail) {
    throw new Error("You cannot demote your own Discourse admin account.");
  }

  if (action === "demote" && before.admin) {
    const admins = await listStaffAdmins();

    if (admins.length <= 1) {
      throw new Error("Cannot demote the last Discourse admin.");
    }
  }

  if (action === "promote" && before.admin) {
    return before;
  }

  if (action === "demote" && !before.admin) {
    return before;
  }

  const endpoint = action === "promote" ? "grant_admin" : "revoke_admin";

  await discourseFetch(`/admin/users/${targetUserId}/${endpoint}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  return await getDiscourseUser(targetUserId);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const adminCheck = await requireTeaTimeAdmin(req);

  if (adminCheck.error) {
    return adminCheck.error;
  }

  const actor = adminCheck.user;

  let body: RequestBody;

  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const action = body.action || "list";

  if (action !== "list" && action !== "promote" && action !== "demote") {
    return json(400, { error: "Invalid action" });
  }

  try {
    if (action === "list") {
      const requestedFlag = body.flag || "all";
      const flag = VALID_FLAGS.has(requestedFlag) ? requestedFlag : "all";
      const page = Number.isFinite(Number(body.page)) ? Math.max(0, Number(body.page)) : 0;
      const search = normalizeSearch(body.search);
      const users = await listDiscourseUsers(flag, page, search);

      return json(200, {
        ok: true,
        flag,
        page,
        users: users.map(sanitizeUser),
      });
    }

    const targetUserId = Number(body.discourse_user_id);

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return json(400, { error: "A valid discourse_user_id is required" });
    }

    let targetBefore: DiscourseUser | null = null;

    try {
      targetBefore = await getDiscourseUser(targetUserId);

      const updatedUser = await changeAdminStatus(action, targetUserId, {
        id: actor.id,
        email: actor.email,
      });

      await logAttempt({
        actorUserId: actor.id,
        actorEmail: actor.email,
        action,
        targetDiscourseUserId: targetUserId,
        targetUsername: updatedUser.username ?? targetBefore.username,
        targetEmail: updatedUser.email ?? targetBefore.email,
        success: true,
      });

      return json(200, {
        ok: true,
        action,
        user: sanitizeUser(updatedUser),
      });
    } catch (error) {
      await logAttempt({
        actorUserId: actor.id,
        actorEmail: actor.email,
        action,
        targetDiscourseUserId: targetUserId,
        targetUsername: targetBefore?.username,
        targetEmail: targetBefore?.email,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});