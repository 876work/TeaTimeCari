import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";

type PresenceStatus =
  | "online_app"
  | "online_community"
  | "online_both"
  | "recently_active"
  | "offline"
  | "unknown";

type ActivitySource = "app" | "community" | "both" | null;

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

const ONLINE_MS = 5 * 60 * 1000;
const RECENT_MS = 15 * 60 * 1000;

const DISCOURSE_BASE_URL = (Deno.env.get("DISCOURSE_BASE_URL") || "").replace(
  /\/+$/,
  ""
);

const DISCOURSE_ADMIN_API_KEY =
  Deno.env.get("DISCOURSE_ADMIN_API_KEY") || "";

const DISCOURSE_ADMIN_API_USERNAME =
  Deno.env.get("DISCOURSE_ADMIN_API_USERNAME") || "system";

const USER_FLAGS = [
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

function clean(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function toTime(value?: string | null) {
  const time = value ? new Date(value).getTime() : NaN;

  return Number.isFinite(time) ? time : null;
}

function newest(a?: string | null, b?: string | null) {
  const at = toTime(a);
  const bt = toTime(b);

  if (at === null) return b ?? null;
  if (bt === null) return a ?? null;

  return at >= bt ? a ?? null : b ?? null;
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

function calculate(
  appLastSeen: string | null,
  discourseLastSeen: string | null,
  now: number
) {
  const appTime = toTime(appLastSeen);
  const communityTime = toTime(discourseLastSeen);

  if (appTime === null && communityTime === null) {
    return {
      status: "unknown" as PresenceStatus,
      lastActivityAt: null,
      source: null as ActivitySource,
    };
  }

  const appOnline = appTime !== null && now - appTime <= ONLINE_MS;
  const communityOnline =
    communityTime !== null && now - communityTime <= ONLINE_MS;

  const appRecent = appTime !== null && now - appTime <= RECENT_MS;
  const communityRecent =
    communityTime !== null && now - communityTime <= RECENT_MS;

  const lastActivityAt = newest(appLastSeen, discourseLastSeen);

  let source: ActivitySource = null;

  if (
    appTime !== null &&
    communityTime !== null &&
    Math.abs(appTime - communityTime) <= 1000
  ) {
    source = "both";
  } else {
    source = (appTime ?? 0) >= (communityTime ?? 0) ? "app" : "community";
  }

  if (appOnline && communityOnline) {
    return {
      status: "online_both" as PresenceStatus,
      lastActivityAt,
      source: "both" as ActivitySource,
    };
  }

  if (appOnline) {
    return {
      status: "online_app" as PresenceStatus,
      lastActivityAt,
      source,
    };
  }

  if (communityOnline) {
    return {
      status: "online_community" as PresenceStatus,
      lastActivityAt,
      source,
    };
  }

  if (appRecent || communityRecent) {
    return {
      status: "recently_active" as PresenceStatus,
      lastActivityAt,
      source,
    };
  }

  return {
    status: "offline" as PresenceStatus,
    lastActivityAt,
    source,
  };
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

async function fetchDiscourseUsers() {
  const merged = new Map<number, DiscourseUser>();

  for (const flag of USER_FLAGS) {
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

      for (const user of users) {
        if (typeof user.id === "number") {
          merged.set(user.id, { ...merged.get(user.id), ...user });
        }
      }

      if (users.length === 0) break;
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

    let discourseUnavailable = false;
    let discourseError: string | null = null;

    const byId = new Map<string, DiscourseUser>();
    const byEmail = new Map<string, DiscourseUser>();
    const byUsername = new Map<string, DiscourseUser>();

    try {
      const discourseUsers = await fetchDiscourseUsers();

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
      discourseUnavailable = true;
      discourseError = "Community presence unavailable";

      console.warn("get-admin-presence discourse lookup failed", error);
    }

    const now = Date.now();

    const presence = registrations.map((user) => {
      const discourseUser =
        byId.get(user.id) ||
        byEmail.get(clean(user.email)) ||
        byUsername.get(clean(user.username)) ||
        null;

      const discourseLastSeen = discourseUnavailable
        ? null
        : discourseUser?.last_seen_at ?? null;

      const calculated = calculate(
        user.last_seen_at ?? null,
        discourseLastSeen,
        now
      );

      return {
        user_id: user.id,
        email: user.email ?? null,
        username: user.username ?? null,
        app_last_seen_at: user.last_seen_at ?? null,
        app_last_login_at: user.last_login_at ?? null,
        discourse_last_seen_at: discourseLastSeen,
        last_activity_at: calculated.lastActivityAt,
        last_activity_source: calculated.source,
        presence_status: calculated.status,
        presence_checked_at: checkedAt,
        discourse_username: discourseUser?.username ?? null,
        discourse_user_id: discourseUser?.id ?? null,
        discourse_sync_status: user.discourse_sync_status ?? null,
        error: discourseUnavailable ? discourseError : null,
      };
    });

    return json(200, {
      ok: true,
      presence,
      discourseUnavailable,
      error: discourseError,
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