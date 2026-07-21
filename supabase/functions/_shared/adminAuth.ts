import { supabaseAdmin } from "./supabaseAdmin.ts";

type AdminRole = "owner" | "admin" | "moderator";

type Permission =
  | "admin:access"
  | "users:view"
  | "users:approve"
  | "users:reject"
  | "users:suspend"
  | "users:invite"
  | "users:reset_password"
  | "posts:moderate"
  | "discourse:admin_manage"
  | "logs:view"
  | "health:view"
  | "admins:manage"
  | "payments:view"
  | "announcements:manage"
  | "alerts:manage"
  | "flags:manage"
  | "ads:manage";

export type AdminActor = {
  userId: string;
  email: string | null;
  role: AdminRole;
  permissions: Permission[];
};

const OWNER_USER_IDS = new Set([
  "26236ea5-4a82-4711-a395-c405f28698d4",
  "cbd00247-f199-497a-a20e-c66b5c78fbc0",
  ...((Deno.env.get("PERMANENT_ADMIN_USER_IDS") || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)),
]);

const OWNER_EMAILS = new Set([
  "admin@teatimecari.app",
  "teatimecari@gmail.com",
  ...((Deno.env.get("PERMANENT_ADMIN_EMAILS") || "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean)),
]);

const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  owner: [
    "admin:access",
    "users:view",
    "users:approve",
    "users:reject",
    "users:suspend",
    "users:invite",
    "users:reset_password",
    "posts:moderate",
    "discourse:admin_manage",
    "logs:view",
    "health:view",
    "admins:manage",
    "payments:view",
    "announcements:manage",
    "alerts:manage",
    "flags:manage",
    "ads:manage",
  ],
  admin: [
    "admin:access",
    "users:view",
    "users:approve",
    "users:reject",
    "users:suspend",
    "users:invite",
    "users:reset_password",
    "posts:moderate",
    "discourse:admin_manage",
    "logs:view",
    "health:view",
    "payments:view",
    "announcements:manage",
    "alerts:manage",
    "ads:manage",
  ],
  moderator: [
    "admin:access",
    "users:view",
    "users:suspend",
    "posts:moderate",
  ],
};

function normalizeEmail(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);

  return match?.[1] || null;
}

function isSchemaCompatibilityError(error: {
  code?: string;
  message?: string;
} | null) {
  const message = error?.message?.toLowerCase() || "";

  return (
    error?.code === "PGRST204" ||
    error?.code === "42703" ||
    error?.code === "42P01" ||
    (message.includes("schema cache") && message.includes("could not find")) ||
    (message.includes("column") && message.includes("does not exist")) ||
    message.includes('relation "public.admin_roles" does not exist')
  );
}

function allowLegacyAdminEmailFallback() {
  return (
    (Deno.env.get("ENABLE_LEGACY_ADMIN_EMAIL_FALLBACK") || "false").toLowerCase() ===
    "true"
  );
}

function roleHasPermission(role: AdminRole, permission: Permission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

async function getProfileAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("is_admin, email")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    if (isSchemaCompatibilityError(error)) {
      return { isAdmin: false, email: null };
    }

    throw error;
  }

  return {
    isAdmin: Boolean(data?.is_admin),
    email: data?.email ?? null,
  };
}

async function getRole(userId: string): Promise<AdminRole | null> {
  const { data, error } = await supabaseAdmin
    .from("admin_roles")
    .select("role")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    if (isSchemaCompatibilityError(error)) return null;

    throw error;
  }

  if (
    data?.role === "owner" ||
    data?.role === "admin" ||
    data?.role === "moderator"
  ) {
    return data.role;
  }

  return null;
}

export async function getAdminActor(req: Request): Promise<AdminActor | null> {
  const token = getBearerToken(req);

  if (!token) return null;

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.getUser(token);

  if (authError || !authData.user) return null;

  const authEmail = normalizeEmail(authData.user.email);
  const profile = await getProfileAdmin(authData.user.id);
  const profileEmail = normalizeEmail(profile.email);
  const role = await getRole(authData.user.id);

  const isPermanentOwner =
    OWNER_USER_IDS.has(authData.user.id) ||
    OWNER_EMAILS.has(authEmail) ||
    OWNER_EMAILS.has(profileEmail);

  const isLegacyAdmin =
    allowLegacyAdminEmailFallback() &&
    [authEmail, profileEmail].some((email) => email.includes("admin"));

  let effectiveRole: AdminRole | null = role;

  if (!effectiveRole && isPermanentOwner) effectiveRole = "owner";
  if (!effectiveRole && profile.isAdmin) effectiveRole = "admin";
  if (!effectiveRole && isLegacyAdmin) effectiveRole = "admin";

  if (!effectiveRole) return null;

  return {
    userId: authData.user.id,
    email: authData.user.email ?? profile.email ?? null,
    role: effectiveRole,
    permissions: ROLE_PERMISSIONS[effectiveRole],
  };
}

export async function requireAdmin(
  req: Request,
  permission: Permission = "admin:access"
) {
  const actor = await getAdminActor(req);

  if (!actor) {
    return {
      actor: null,
      error: "Forbidden: admin only",
      status: 403,
    } as const;
  }

  if (!roleHasPermission(actor.role, permission)) {
    return {
      actor: null,
      error: `Forbidden: missing ${permission}`,
      status: 403,
    } as const;
  }

  return {
    actor,
    error: null,
    status: 200,
  } as const;
}

export async function writeAdminAuditLog(input: {
  actor?: AdminActor | null;
  req?: Request;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  targetEmail?: string | null;
  previousStatus?: string | null;
  nextStatus?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  success?: boolean;
  errorMessage?: string | null;
}) {
  const { error } = await supabaseAdmin.from("admin_audit_logs").insert({
    actor_user_id: input.actor?.userId ?? null,
    actor_email: input.actor?.email ?? null,
    actor_role: input.actor?.role ?? null,
    action: input.action,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    target_email: input.targetEmail ?? null,
    previous_status: input.previousStatus ?? null,
    next_status: input.nextStatus ?? null,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
    ip_address:
      input.req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: input.req?.headers.get("user-agent") ?? null,
    success: input.success ?? true,
    error_message: input.errorMessage ?? null,
  });

  if (error) {
    console.warn("Unable to write admin audit log", error);
  }
}