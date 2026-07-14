import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { requireAdmin, writeAdminAuditLog } from "../_shared/adminAuth.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type RoleValue = "owner" | "admin" | "moderator";
const VALID_ROLES = new Set<RoleValue>(["owner", "admin", "moderator"]);

type RequestBody = {
  action?: "list" | "grant" | "revoke";
  email?: string;
  role?: string;
  user_id?: string;
};

async function listAdmins() {
  const { data: roles, error } = await supabaseAdmin
    .from("admin_roles")
    .select("user_id, role, created_at, updated_at, revoked_at")
    .order("created_at", { ascending: true });

  if (error) throw error;

  const userIds = [...new Set((roles ?? []).map((row) => row.user_id))];
  const identityById = new Map<string, { email: string | null; username: string | null }>();

  if (userIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .in("id", userIds);

    for (const profile of profiles ?? []) {
      identityById.set(profile.id, { email: profile.email ?? null, username: null });
    }

    const { data: registrations } = await supabaseAdmin
      .from("registrations")
      .select("id, email, username")
      .in("id", userIds);

    for (const reg of registrations ?? []) {
      const existing = identityById.get(reg.id);
      identityById.set(reg.id, {
        email: existing?.email ?? reg.email ?? null,
        username: reg.username ?? null,
      });
    }
  }

  return (roles ?? []).map((row) => ({
    ...row,
    email: identityById.get(row.user_id)?.email ?? null,
    username: identityById.get(row.user_id)?.username ?? null,
  }));
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("email", normalized)
    .maybeSingle();

  if (profile?.id) return profile.id;

  const { data: registration } = await supabaseAdmin
    .from("registrations")
    .select("id")
    .ilike("email", normalized)
    .maybeSingle();

  return registration?.id ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = req.method === "POST"
      ? (await req.json().catch(() => ({}))) as RequestBody
      : {} as RequestBody;
    const action = body.action ?? "list";

    // Listing is available to any admin; granting/revoking requires admins:manage.
    const adminCheck = await requireAdmin(
      req,
      action === "list" ? "admin:access" : "admins:manage",
    );
    if (!adminCheck.actor) {
      return json(adminCheck.status, { ok: false, error: adminCheck.error });
    }
    const actor = adminCheck.actor;

    if (action === "list") {
      return json(200, {
        ok: true,
        admins: await listAdmins(),
        canManage: actor.permissions.includes("admins:manage"),
      });
    }

    if (action === "grant") {
      const email = (body.email ?? "").trim();
      const role = (body.role ?? "").trim() as RoleValue;

      if (!email) return json(400, { ok: false, error: "Email is required." });
      if (!VALID_ROLES.has(role)) {
        return json(400, { ok: false, error: "Role must be owner, admin, or moderator." });
      }

      const userId = body.user_id?.trim() || (await findUserIdByEmail(email));
      if (!userId) {
        return json(404, {
          ok: false,
          error: `No account found for ${email}. The user must have a Tea Time Cari account before a role can be granted.`,
        });
      }

      const { error: upsertError } = await supabaseAdmin
        .from("admin_roles")
        .upsert(
          { user_id: userId, role, revoked_at: null },
          { onConflict: "user_id" },
        );

      if (upsertError) throw upsertError;

      await writeAdminAuditLog({
        actor,
        req,
        action: "admin_role_granted",
        targetType: "admin_role",
        targetId: userId,
        targetEmail: email,
        nextStatus: role,
        metadata: { role },
      });

      return json(200, { ok: true, admins: await listAdmins() });
    }

    if (action === "revoke") {
      const userId = body.user_id?.trim();
      if (!userId) return json(400, { ok: false, error: "user_id is required." });

      if (userId === actor.userId) {
        return json(400, { ok: false, error: "You cannot revoke your own admin role." });
      }

      const { error: revokeError } = await supabaseAdmin
        .from("admin_roles")
        .update({ revoked_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("revoked_at", null);

      if (revokeError) throw revokeError;

      await writeAdminAuditLog({
        actor,
        req,
        action: "admin_role_revoked",
        targetType: "admin_role",
        targetId: userId,
        targetEmail: body.email ?? null,
        nextStatus: "revoked",
      });

      return json(200, { ok: true, admins: await listAdmins() });
    }

    return json(400, { ok: false, error: `Unknown action: ${action}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[admin-manage-roles] error:", message);
    return json(500, { ok: false, error: message });
  }
});
