import { corsHeaders } from "../_shared/cors.ts";
import { getAdminActor, writeAdminAuditLog } from "../_shared/adminAuth.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") return json(405, { ok: false, error: "Method not allowed" });

  const actor = await getAdminActor(req);

  await writeAdminAuditLog({
    actor,
    req,
    action: actor ? "admin_access_verified" : "admin_access_denied",
    targetType: "admin_session",
    success: Boolean(actor),
    errorMessage: actor ? null : "Admin role not found",
  });

  if (!actor) return json(403, { ok: false, admin: false, error: "Forbidden: admin only" });

  return json(200, {
    ok: true,
    admin: true,
    user: {
      id: actor.userId,
      email: actor.email,
    },
    role: actor.role,
    roles: [actor.role],
    permissions: actor.permissions,
  });
});
