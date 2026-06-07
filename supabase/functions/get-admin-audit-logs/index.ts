import { corsHeaders } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") return json(405, { ok: false, error: "Method not allowed" });

  const adminCheck = await requireAdmin(req, "logs:view");
  if (!adminCheck.actor) return json(adminCheck.status, { ok: false, error: adminCheck.error });

  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const limit = Math.min(Math.max(Number(body.limit ?? 100), 1), 250);

  const { data, error } = await supabaseAdmin
    .from("admin_audit_logs")
    .select("id, actor_user_id, actor_email, actor_role, action, target_type, target_id, target_email, previous_status, next_status, reason, metadata, success, error_message, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return json(500, { ok: false, error: "audit log lookup failed", detail: error.message });

  return json(200, { ok: true, logs: data ?? [] });
});
