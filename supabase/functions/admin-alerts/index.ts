import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { requireAdmin, writeAdminAuditLog } from "../_shared/adminAuth.ts";
import {
  getAlertSettings,
  sendSlackMessage,
  sendAndLogAlert,
  type AlertSettings,
} from "../_shared/slack.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type RequestBody = {
  action?: "get" | "save" | "test" | "run-checks";
  settings?: Partial<AlertSettings> & { slack_webhook_url?: string | null };
};

function maskWebhookUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const tail = parsed.pathname.slice(-4);
    return `${parsed.origin}/…${tail}`;
  } catch {
    return "configured";
  }
}

async function serializeSettings() {
  const settings = await getAlertSettings();
  const envFallback = Boolean(Deno.env.get("SLACK_ALERT_WEBHOOK_URL")?.trim());

  return {
    alerts_enabled: settings.alerts_enabled,
    pending_users_threshold: settings.pending_users_threshold,
    flagged_posts_threshold: settings.flagged_posts_threshold,
    notify_on_new_registration: settings.notify_on_new_registration,
    notify_on_high_risk_post: settings.notify_on_high_risk_post,
    notify_on_payment_failure: settings.notify_on_payment_failure,
    webhook_configured: Boolean(settings.slack_webhook_url?.trim()) || envFallback,
    webhook_masked: maskWebhookUrl(settings.slack_webhook_url) ?? (envFallback ? "configured via env" : null),
  };
}

async function getRecentEvents() {
  const { data, error } = await supabaseAdmin
    .from("admin_alert_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return [];
  return data ?? [];
}

async function runThresholdChecks(settings: AlertSettings) {
  const results: Array<{ check: string; triggered: boolean; value: number; threshold: number }> = [];

  const { count: pendingCount } = await supabaseAdmin
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .ilike("status", "%pending%");

  const pending = pendingCount ?? 0;
  const pendingTriggered = pending >= settings.pending_users_threshold;
  results.push({
    check: "pending_users",
    triggered: pendingTriggered,
    value: pending,
    threshold: settings.pending_users_threshold,
  });

  if (pendingTriggered) {
    await sendAndLogAlert({
      alertType: "pending_users_threshold",
      message: `:hourglass_flowing_sand: *Tea Time Cari*: ${pending} registrations are waiting for review (threshold: ${settings.pending_users_threshold}).`,
      payload: { pending, threshold: settings.pending_users_threshold },
      settings,
    });
  }

  const { count: flaggedCount, error: flaggedError } = await supabaseAdmin
    .from("posts")
    .select("id", { count: "exact", head: true })
    .gte("red_flag_count", 5);

  if (!flaggedError) {
    const flagged = flaggedCount ?? 0;
    const flaggedTriggered = flagged >= settings.flagged_posts_threshold;
    results.push({
      check: "high_risk_posts",
      triggered: flaggedTriggered,
      value: flagged,
      threshold: settings.flagged_posts_threshold,
    });

    if (flaggedTriggered && settings.notify_on_high_risk_post) {
      await sendAndLogAlert({
        alertType: "high_risk_posts_threshold",
        message: `:rotating_light: *Tea Time Cari*: ${flagged} high-risk posts (5+ red flags) are in the moderation queue (threshold: ${settings.flagged_posts_threshold}).`,
        payload: { flagged, threshold: settings.flagged_posts_threshold },
        settings,
      });
    }
  }

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: failedPayments, error: paymentsError } = await supabaseAdmin
    .from("payments")
    .select("id", { count: "exact", head: true })
    .in("status", ["failed", "canceled", "cancelled"])
    .gte("created_at", dayAgo);

  if (!paymentsError) {
    const failures = failedPayments ?? 0;
    const failuresTriggered = failures > 0 && settings.notify_on_payment_failure;
    results.push({ check: "payment_failures_24h", triggered: failuresTriggered, value: failures, threshold: 1 });

    if (failuresTriggered) {
      await sendAndLogAlert({
        alertType: "payment_failures",
        message: `:credit_card: *Tea Time Cari*: ${failures} failed payment${failures === 1 ? "" : "s"} in the last 24 hours.`,
        payload: { failures },
        settings,
      });
    }
  }

  return results;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const adminCheck = await requireAdmin(req, "alerts:manage");
    if (!adminCheck.actor) {
      return json(adminCheck.status, { ok: false, error: adminCheck.error });
    }
    const actor = adminCheck.actor;

    const body = req.method === "POST"
      ? (await req.json().catch(() => ({}))) as RequestBody
      : {} as RequestBody;
    const action = body.action ?? "get";

    if (action === "get") {
      return json(200, {
        ok: true,
        settings: await serializeSettings(),
        events: await getRecentEvents(),
      });
    }

    if (action === "save") {
      const incoming = body.settings ?? {};
      const patch: Record<string, unknown> = { updated_by: actor.userId, updated_at: new Date().toISOString() };

      if (typeof incoming.alerts_enabled === "boolean") patch.alerts_enabled = incoming.alerts_enabled;
      if (typeof incoming.notify_on_new_registration === "boolean") patch.notify_on_new_registration = incoming.notify_on_new_registration;
      if (typeof incoming.notify_on_high_risk_post === "boolean") patch.notify_on_high_risk_post = incoming.notify_on_high_risk_post;
      if (typeof incoming.notify_on_payment_failure === "boolean") patch.notify_on_payment_failure = incoming.notify_on_payment_failure;

      if (incoming.pending_users_threshold !== undefined) {
        const value = Number(incoming.pending_users_threshold);
        if (Number.isFinite(value)) patch.pending_users_threshold = Math.min(Math.max(Math.floor(value), 1), 10000);
      }
      if (incoming.flagged_posts_threshold !== undefined) {
        const value = Number(incoming.flagged_posts_threshold);
        if (Number.isFinite(value)) patch.flagged_posts_threshold = Math.min(Math.max(Math.floor(value), 1), 10000);
      }

      // Only overwrite the stored webhook when a new value is provided;
      // an empty string clears it.
      if (typeof incoming.slack_webhook_url === "string") {
        const trimmed = incoming.slack_webhook_url.trim();
        if (trimmed === "") {
          patch.slack_webhook_url = null;
        } else if (!/^https:\/\/hooks\.slack\.com\//.test(trimmed)) {
          return json(400, { ok: false, error: "Webhook URL must start with https://hooks.slack.com/" });
        } else {
          patch.slack_webhook_url = trimmed;
        }
      }

      const { error } = await supabaseAdmin
        .from("admin_alert_settings")
        .upsert({ id: 1, ...patch }, { onConflict: "id" });

      if (error) throw error;

      await writeAdminAuditLog({
        actor,
        req,
        action: "alert_settings_updated",
        targetType: "alert_settings",
        metadata: { ...patch, slack_webhook_url: patch.slack_webhook_url ? "updated" : undefined },
      });

      return json(200, { ok: true, settings: await serializeSettings() });
    }

    if (action === "test") {
      const settings = await getAlertSettings();
      const result = await sendSlackMessage(
        `:white_check_mark: *Tea Time Cari* test alert sent by ${actor.email ?? "an admin"} — your Slack alert webhook is working.`,
        { settings },
      );

      await writeAdminAuditLog({
        actor,
        req,
        action: "alert_test_sent",
        targetType: "alert_settings",
        success: result.success,
        errorMessage: result.error ?? null,
      });

      if (!result.success) {
        return json(200, { ok: false, error: result.error ?? "Failed to send test message." });
      }

      return json(200, { ok: true });
    }

    if (action === "run-checks") {
      const settings = await getAlertSettings();

      if (!settings.alerts_enabled) {
        return json(200, { ok: false, error: "Alerts are disabled. Enable them before running checks." });
      }

      const results = await runThresholdChecks(settings);

      return json(200, {
        ok: true,
        results,
        events: await getRecentEvents(),
      });
    }

    return json(400, { ok: false, error: `Unknown action: ${action}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[admin-alerts] error:", message);
    return json(500, { ok: false, error: message });
  }
});
