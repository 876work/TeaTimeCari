import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";

import { APP_TRACKING_STALE_MS, calculatePresence, toTime } from "../_shared/presence.ts";

type Registration = {
  id: string;
  email?: string | null;
  username?: string | null;
  status?: string | null;
  last_seen_at?: string | null;
  last_login_at?: string | null;
  discourse_sync_status?: string | null;
};

type DiscourseUser = {
  id?: number;
  username?: string | null;
  email?: string | null;
  last_seen_at?: string | null;
  external_id?: string | null;
  external_ids?: string[] | null;
  single_sign_on_record?: { external_id?: string | null } | null;
};

const DISCOURSE_BASE_URL = (Deno.env.get("DISCOURSE_BASE_URL") || "").replace(/\/+$/, "");
const DISCOURSE_ADMIN_API_KEY = Deno.env.get("DISCOURSE_ADMIN_API_KEY") || "";
const DISCOURSE_ADMIN_API_USERNAME = Deno.env.get("DISCOURSE_ADMIN_API_USERNAME") || "system";
const USER_FLAGS = ["active", "staff", "suspended", "new", "blocked", "suspect"];

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function clean(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function externalIds(user: DiscourseUser) {
  return [
    user.external_id,
    ...(Array.isArray(user.external_ids) ? user.external_ids : []),
    user.single_sign_on_record?.external_id,
  ]
    .map((value) => (value || "").trim())
    .filter(Boolean);
}

async function discourseFetch(path: string) {
  if (!DISCOURSE_BASE_URL || !DISCOURSE_ADMIN_API_KEY) {
    throw new Error("Discourse presence is not configured");
  }

  const res = await fetch(`${DISCOURSE_BASE_URL}${path}`, {
    headers: {
      "Api-Key": DISCOURSE_ADMIN_API_KEY,
      "Api-Username": DISCOURSE_ADMIN_API_USERNAME,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Discourse API failed with ${res.status}`);
  }

  return await res.json();
}

async function fetchUsersForFlag(flag: string) {
  const collected: DiscourseUser[] = [];

  for (let page = 0; page < 3; page += 1) {
    const params = new URLSearchParams({
      page: String(page),
      show_emails: "true",
      order: "last_seen",
    });

    const body = await discourseFetch(
      `/admin/users/list/${flag}.json?${params}`
    );

    const users = Array.isArray(body) ? (body as DiscourseUser[]) : [];
    collected.push(...users);

    if (users.length === 0) break;
  }

  return collected;
}

async function fetchDiscourseUsers() {
  const merged = new Map<number, DiscourseUser>();

  // Each flag's pages are fetched in sequence (page N depends on page N-1
  // not being empty), but the flags themselves are independent, so fetch
  // all of them concurrently instead of one after another.
  const usersByFlag = await Promise.all(USER_FLAGS.map(fetchUsersForFlag));

  for (const users of usersByFlag) {
    for (const user of users) {
      if (typeof user.id === "number") {
        merged.set(user.id, { ...merged.get(user.id), ...user });
      }
    }
  }

  return [...merged.values()];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  const checkedAt = new Date().toISOString();

  try {
    const adminCheck = await requireAdmin(req, "users:view");

    if (!adminCheck.actor) {
      return json(adminCheck.status, {
        ok: false,
        error: adminCheck.error,
      });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body?.action === "lookup_heartbeat") {
        const rawEmail = typeof body.email === "string" && body.email.trim()
          ? body.email.trim().toLowerCase()
          : (adminCheck.actor.email || "").trim().toLowerCase();
        if (!rawEmail) return json(400, { success: false, ok: false, error: "email_required" });
        const { data: registration, error: lookupError } = await supabaseAdmin
          .from("registrations")
          .select("id,email,last_seen_at")
          .ilike("email", rawEmail)
          .maybeSingle();
        if (lookupError) throw lookupError;
        const lastSeenAt = registration?.last_seen_at ?? null;
        const lastSeenTime = toTime(lastSeenAt);
        const ageSeconds = lastSeenTime === null ? null : Math.max(0, Math.round((Date.now() - lastSeenTime) / 1000));
        const calculated = calculatePresence(lastSeenAt, null, Date.now());
        return json(200, {
          success: true,
          ok: true,
          registrationFound: Boolean(registration),
          registrationId: registration?.id ?? null,
          userId: registration?.id ?? null,
          email: registration?.email ?? rawEmail,
          lastSeenAt,
          heartbeatAgeSeconds: ageSeconds,
          appPresenceState: calculated.status === "online_app" ? "online_app" : calculated.appRecent ? "recently_active" : lastSeenAt ? "offline" : "unknown",
          checkedAt,
        });
      }
    }

    let { data, error } = await supabaseAdmin
      .from("registrations")
      .select(
        "id,email,username,status,last_seen_at,last_login_at,discourse_sync_status"
      )
      .limit(1000);

    if (error) {
      const message = `${error.message ?? ""} ${
        error.details ?? ""
      }`.toLowerCase();

      if (
        error.code === "PGRST204" ||
        message.includes("discourse_sync_status") ||
        message.includes("schema cache")
      ) {
        const fallback = await supabaseAdmin
          .from("registrations")
          .select("id,email,username,status,last_seen_at,last_login_at")
          .limit(1000);

        data = fallback.data;
        error = fallback.error;
      }
    }

    if (error) throw error;

    const registrations = (data ?? []) as Registration[];

    let communityStatus: "available" | "unavailable" | "degraded" | "unknown" = "unknown";
    let communityMessage: string | null = null;

    const byId = new Map<string, DiscourseUser>();
    const byEmail = new Map<string, DiscourseUser>();
    const byUsername = new Map<string, DiscourseUser>();

    try {
      const discourseUsers = await fetchDiscourseUsers();
      communityStatus = "available";

      for (const discourseUser of discourseUsers) {
        for (const id of externalIds(discourseUser)) {
          byId.set(id, discourseUser);
        }

        if (discourseUser.email) {
          byEmail.set(clean(discourseUser.email), discourseUser);
        }

        if (discourseUser.username) {
          byUsername.set(clean(discourseUser.username), discourseUser);
        }
      }
    } catch (error) {
      communityStatus = "unavailable";
      communityMessage = "Community activity could not be checked. App presence remains available.";

      console.warn("get-admin-presence discourse lookup failed", error instanceof Error ? error.message : String(error));
    }

    const now = Date.now();

    const presence = registrations.map((user) => {
      const discourseUser =
        byId.get(user.id) ||
        byEmail.get(clean(user.email)) ||
        byUsername.get(clean(user.username)) ||
        null;

      const discourseLastSeen = communityStatus === "unavailable"
        ? null
        : discourseUser?.last_seen_at ?? null;

      const calculated = calculatePresence(user.last_seen_at ?? null, discourseLastSeen, now);

      return {
        user_id: user.id,
        email: user.email ?? null,
        username: user.username ?? null,
        app_last_seen_at: user.last_seen_at ?? null,
        app_last_login_at: user.last_login_at ?? null,
        discourse_last_seen_at: discourseLastSeen,
        appPresence: { isOnline: calculated.appOnline, lastSeenAt: user.last_seen_at ?? null },
        communityPresence: { isAvailable: communityStatus === "available", isOnline: communityStatus === "available" ? calculated.communityOnline : null, lastSeenAt: discourseLastSeen, matched: Boolean(discourseUser) },
        last_activity_at: calculated.lastActivityAt,
        last_activity_source: calculated.source,
        presence_status: calculated.status,
        presence_checked_at: checkedAt,
        discourse_username: discourseUser?.username ?? null,
        discourse_user_id: discourseUser?.id ?? null,
        discourse_sync_status: user.discourse_sync_status ?? null,
        activitySource: calculated.source,
      };
    });

    const latestAppActivity = registrations
      .map((user) => user.last_seen_at ?? null)
      .filter(Boolean)
      .sort((a, b) => (toTime(b) ?? 0) - (toTime(a) ?? 0))[0] ?? null;
    const latestAppTime = toTime(latestAppActivity);
    const appStatus = latestAppTime === null ? "unknown" : now - latestAppTime <= APP_TRACKING_STALE_MS ? "healthy" : "stale";

    return json(200, {
      success: true,
      ok: true,
      generatedAt: checkedAt,
      systemStatus: {
        appTracking: {
          status: appStatus,
          lastSuccessfulActivityAt: latestAppActivity,
          message: appStatus === "stale" ? "Recent app activity has not been recorded within the expected tracking window." : null,
        },
        communityTracking: {
          status: communityStatus,
          checkedAt,
          message: communityMessage,
        },
      },
      users: presence.map((p) => ({
        id: p.user_id,
        email: p.email,
        username: p.username,
        presenceStatus: p.presence_status,
        activitySource: p.activitySource,
        appPresence: p.appPresence,
        communityPresence: p.communityPresence,
      })),
      presence,
      discourseUnavailable: communityStatus !== "available",
      error: communityMessage,
      presence_checked_at: checkedAt,
    });
  } catch (error) {
    console.error("get-admin-presence error", error);

    return json(500, {
      ok: false,
      error: "internal",
    });
  }
});