import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorInfo(error: unknown) {
  if (error && typeof error === "object") {
    const maybeError = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown; name?: unknown };
    return {
      name: maybeError.name,
      code: maybeError.code,
      message: maybeError.message,
      details: maybeError.details,
      hint: maybeError.hint,
    };
  }

  return { message: String(error) };
}

type PostgrestLikeError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function errorSearchText(error: PostgrestLikeError | null) {
  return [error?.message, error?.details, error?.hint].filter(Boolean).join(" ");
}

function normalizeColumnName(column: string | undefined) {
  if (!column) return null;

  const unquoted = column.replace(/"/g, "");
  const parts = unquoted.split(".").filter(Boolean);
  return parts[parts.length - 1] || null;
}

function isSchemaCacheColumnError(error: PostgrestLikeError | null) {
  const text = errorSearchText(error).toLowerCase();
  return (
    error?.code === "PGRST204" ||
    error?.code === "42703" ||
    (text.includes("schema cache") && text.includes("could not find")) ||
    (text.includes("could not find") && text.includes("column")) ||
    (text.includes("column") && text.includes("does not exist"))
  );
}

function missingColumnName(error: PostgrestLikeError | null) {
  const text = errorSearchText(error);
  return normalizeColumnName(
    text.match(/Could not find the '([^']+)' column/i)?.[1] ||
    text.match(/column\s+((?:"?[a-zA-Z0-9_]+"?\.)?"?[a-zA-Z0-9_]+"?)\s+does not exist/i)?.[1],
  );
}

const REGISTRATION_FIELDS = [
  "id",
  "firstName",
  "lastName",
  "email",
  "phone",
  "username",
  "gender",
  "captureType",
  "imageData",
  "status",
  "created_at",
  "rejection_reason",
];

const OPTIONAL_REGISTRATION_FIELDS = new Set([
  "rejection_reason",
]);

const TRACKING_FIELDS = [
  "registration_ip_address",
  "registration_ip_header",
  "registration_ip_location",
  "registration_city",
  "registration_region",
  "registration_country",
  "registration_country_code",
  "registration_timezone",
  "registration_location_provider",
  "registration_location_status",
  "registration_browser",
  "registration_device",
  "registration_operating_system",
  "registration_user_agent",
  "registration_tracked_at",
  "last_login_at",
  "last_login_ip_address",
  "last_login_ip_header",
  "last_login_ip_location",
  "last_login_city",
  "last_login_region",
  "last_login_country",
  "last_login_country_code",
  "last_login_timezone",
  "last_login_location_provider",
  "last_login_location_status",
  "last_login_browser",
  "last_login_device",
  "last_login_operating_system",
  "last_login_user_agent",
  "last_seen_at",
];

function withNullFields(users: Record<string, unknown>[], fields: string[]) {
  return users.map((user) => ({
    ...user,
    ...Object.fromEntries(fields.filter((field) => !(field in user)).map((field) => [field, null])),
  }));
}

// Discovering which optional tracking columns actually exist requires
// removing them one at a time on schema-cache errors (PostgREST only
// reports one missing column per failed query). That's cheap once, but
// without caching it repeats on every single request from a cold
// function instance. Remember the last known-good column set across
// invocations on the same warm instance so repeat page loads/pagination
// skip straight to a working query instead of re-probing from scratch.
// The TTL lets it self-heal (pick up newly-added columns) without
// needing a redeploy once a pending migration is applied.
const COLUMN_CACHE_TTL_MS = 5 * 60 * 1000;
let columnCache: { selectedFields: string[]; omittedFields: string[]; cachedAt: number } | null = null;

async function fetchRegistrations({ limit = 10, offset = 0 }: { limit?: number; offset?: number } = {}) {
  const cacheIsFresh = columnCache !== null && Date.now() - columnCache.cachedAt < COLUMN_CACHE_TTL_MS;
  const selectedFields = new Set(cacheIsFresh ? columnCache!.selectedFields : [...REGISTRATION_FIELDS, ...TRACKING_FIELDS]);
  const omittedFields = new Set<string>(cacheIsFresh ? columnCache!.omittedFields : []);

  for (let attempts = 0; attempts < REGISTRATION_FIELDS.length + TRACKING_FIELDS.length + 1; attempts += 1) {
    const select = [...selectedFields].join(", ");
    const { data, error, count } = await admin
      .from("registrations")
      .select(select, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (!error) {
      columnCache = { selectedFields: [...selectedFields], omittedFields: [...omittedFields], cachedAt: Date.now() };

      return {
        users: withNullFields((data ?? []) as Record<string, unknown>[], [...omittedFields]),
        total: count ?? 0,
        limit,
        offset,
        trackingFieldsAvailable: TRACKING_FIELDS.every((field) => selectedFields.has(field)),
        omittedFields: [...omittedFields],
      };
    }

    if (!isSchemaCacheColumnError(error)) throw error;

    const missingColumn = missingColumnName(error);
    const fieldToRemove = missingColumn && selectedFields.has(missingColumn)
      ? missingColumn
      : TRACKING_FIELDS.find((field) => selectedFields.has(field));

    if (!fieldToRemove) throw error;

    if (!TRACKING_FIELDS.includes(fieldToRemove) && !OPTIONAL_REGISTRATION_FIELDS.has(fieldToRemove)) {
      throw error;
    }

    console.warn(
      `registrations column ${fieldToRemove} is unavailable; retrying admin user lookup without it`,
      error,
    );
    selectedFields.delete(fieldToRemove);
    omittedFields.add(fieldToRemove);
  }

  throw new Error("Unable to resolve available registration columns");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  let stage = "start";

  try {
    stage = "verify_admin";
    const adminCheck = await requireAdmin(req, "users:view");
    if (!adminCheck.actor) {
      return json(adminCheck.status, { ok: false, error: adminCheck.error, stage });
    }

    let pagination = { limit: 10, offset: 0 };

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({})) as { limit?: unknown; offset?: unknown };
      const requestedLimit = typeof body.limit === "number" ? body.limit : Number(body.limit);
      const requestedOffset = typeof body.offset === "number" ? body.offset : Number(body.offset);

      pagination = {
        limit: Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 50) : 10,
        offset: Number.isFinite(requestedOffset) ? Math.max(Math.floor(requestedOffset), 0) : 0,
      };
    }

    stage = "fetch_registrations";
    const result = await fetchRegistrations(pagination);

    return json(200, {
      ok: true,
      users: result.users,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      trackingFieldsAvailable: result.trackingFieldsAvailable,
      omittedFields: result.omittedFields,
    });
  } catch (error) {
    console.error("get-admin-users error", { stage, ...errorInfo(error) });
    return json(500, { ok: false, error: "internal", stage, detail: errorInfo(error) });
  }
});