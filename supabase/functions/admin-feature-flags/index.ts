import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { requireAdmin, writeAdminAuditLog } from "../_shared/adminAuth.ts";
import { describeError, isMissingTableError } from "../_shared/pgErrors.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type RequestBody = {
  action?: "list" | "set";
  key?: string;
  enabled?: boolean;
};

async function listFlags() {
  const { data, error } = await supabaseAdmin
    .from("feature_flags")
    .select("*")
    .order("key", { ascending: true });

  if (error) {
    if (isMissingTableError(error)) return { flags: [], tableMissing: true };
    throw error;
  }

  return { flags: data ?? [], tableMissing: false };
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

    // Any admin may view flags; only owners (flags:manage) may change them.
    const adminCheck = await requireAdmin(
      req,
      action === "set" ? "flags:manage" : "admin:access",
    );
    if (!adminCheck.actor) {
      return json(adminCheck.status, { ok: false, error: adminCheck.error });
    }
    const actor = adminCheck.actor;

    if (action === "list") {
      const { flags, tableMissing } = await listFlags();
      return json(200, {
        ok: true,
        flags,
        tableMissing,
        canManage: actor.permissions.includes("flags:manage"),
      });
    }

    if (action === "set") {
      const key = (body.key ?? "").trim();
      if (!key) return json(400, { ok: false, error: "Flag key is required." });
      if (typeof body.enabled !== "boolean") {
        return json(400, { ok: false, error: "enabled must be true or false." });
      }

      const { data: updated, error } = await supabaseAdmin
        .from("feature_flags")
        .update({ enabled: body.enabled, updated_by: actor.userId })
        .eq("key", key)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!updated) return json(404, { ok: false, error: `Unknown feature flag: ${key}` });

      await writeAdminAuditLog({
        actor,
        req,
        action: body.enabled ? "feature_flag_enabled" : "feature_flag_disabled",
        targetType: "feature_flag",
        targetId: key,
        nextStatus: body.enabled ? "enabled" : "disabled",
        metadata: { label: updated.label },
      });

      const { flags } = await listFlags();
      return json(200, { ok: true, flags, canManage: true });
    }

    return json(400, { ok: false, error: `Unknown action: ${action}` });
  } catch (error) {
    const message = describeError(error);
    console.error("[admin-feature-flags] error:", message);
    return json(500, { ok: false, error: message });
  }
});
