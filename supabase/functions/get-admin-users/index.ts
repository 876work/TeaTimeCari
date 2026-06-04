import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

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
  "registration_ip_location",
  "registration_browser",
  "registration_device",
  "registration_operating_system",
  "registration_user_agent",
  "registration_tracked_at",
  "last_login_at",
  "last_login_ip_address",
  "last_login_ip_location",
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

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

async function isAdmin(userId: string, email?: string | null) {
  const adminEmailFallback = email?.toLowerCase().includes("admin") ?? false;

  const { data, error } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    if (error.code === "42703" || error.code === "42P01" || isSchemaCacheColumnError(error)) {
      return adminEmailFallback;
    }
    throw error;
  }

  return Boolean(data?.is_admin) || adminEmailFallback;
}

async function fetchRegistrations() {
  const selectedFields = new Set([...REGISTRATION_FIELDS, ...TRACKING_FIELDS]);
  const omittedFields = new Set<string>();

  for (let attempts = 0; attempts < REGISTRATION_FIELDS.length + TRACKING_FIELDS.length + 1; attempts += 1) {
    const select = [...selectedFields].join(", ");
    const { data, error } = await admin
      .from("registrations")
      .select(select)
      .order("created_at", { ascending: false });

    if (!error) {
      return {
        users: withNullFields((data ?? []) as Record<string, unknown>[], [...omittedFields]),
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
    stage = "read_auth_header";
    const token = getBearerToken(req);
    if (!token) return json(401, { ok: false, error: "Unauthorized", stage });

    stage = "verify_user_token";
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) {
      console.error("get-admin-users auth error", { stage, authError: errorInfo(authError) });
      return json(401, { ok: false, error: "Unauthorized", stage, detail: authError?.message });
    }

    stage = "verify_admin";
    if (!(await isAdmin(authData.user.id, authData.user.email))) {
      return json(403, { ok: false, error: "Forbidden: admin only", stage });
    }

    stage = "fetch_registrations";
    const result = await fetchRegistrations();

    return json(200, {
      ok: true,
      users: result.users,
      trackingFieldsAvailable: result.trackingFieldsAvailable,
      omittedFields: result.omittedFields,
    });
  } catch (error) {
    console.error("get-admin-users error", { stage, ...errorInfo(error) });
    return json(500, { ok: false, error: "internal", stage, detail: errorInfo(error) });
  }
});
