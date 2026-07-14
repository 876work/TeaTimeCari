import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";
import { getAlertSettings } from "../_shared/slack.ts";
import { describeError, isMissingTableError } from "../_shared/pgErrors.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type CheckStatus = "ok" | "warn" | "fail";

type HealthCheck = {
  id: string;
  name: string;
  status: CheckStatus;
  message: string;
  latencyMs: number | null;
};

async function timed(run: () => Promise<Omit<HealthCheck, "latencyMs">>): Promise<HealthCheck> {
  const startedAt = Date.now();
  try {
    const result = await run();
    return { ...result, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      id: "unknown",
      name: "Check failed",
      status: "fail",
      message: describeError(error),
      latencyMs: Date.now() - startedAt,
    };
  }
}

async function checkDatabase(): Promise<Omit<HealthCheck, "latencyMs">> {
  const { error } = await supabaseAdmin
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .limit(1);

  if (error && !isMissingTableError(error)) {
    return { id: "database", name: "Database", status: "fail", message: describeError(error) };
  }

  return {
    id: "database",
    name: "Database",
    status: error ? "warn" : "ok",
    message: error ? "Connected, but the registrations table is missing." : "Queries are responding normally.",
  };
}

async function checkTables(): Promise<Omit<HealthCheck, "latencyMs">> {
  const tables = [
    "payments",
    "invite_codes",
    "email_invites",
    "feature_flags",
    "site_announcements",
    "admin_alert_settings",
    "admin_audit_logs",
  ];

  const missing: string[] = [];
  for (const table of tables) {
    const { error } = await supabaseAdmin.from(table).select("*", { head: true }).limit(1);
    if (isMissingTableError(error)) missing.push(table);
  }

  if (missing.length === 0) {
    return { id: "tables", name: "Admin tables", status: "ok", message: "All admin tables are present." };
  }

  return {
    id: "tables",
    name: "Admin tables",
    status: "warn",
    message: `Missing tables (run pending migrations): ${missing.join(", ")}`,
  };
}

async function checkResend(): Promise<Omit<HealthCheck, "latencyMs">> {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL")?.trim();

  if (!apiKey) {
    return { id: "resend", name: "Resend email", status: "fail", message: "RESEND_API_KEY is not configured." };
  }
  if (!fromEmail) {
    return { id: "resend", name: "Resend email", status: "warn", message: "RESEND_FROM_EMAIL is not configured." };
  }

  const response = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (response.status === 401 || response.status === 403) {
    return { id: "resend", name: "Resend email", status: "fail", message: "Resend rejected the API key." };
  }
  if (!response.ok) {
    return { id: "resend", name: "Resend email", status: "warn", message: `Resend API returned ${response.status}.` };
  }

  return { id: "resend", name: "Resend email", status: "ok", message: "API key accepted; email sending is available." };
}

async function checkStripe(): Promise<Omit<HealthCheck, "latencyMs">> {
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY")?.trim();

  if (!secretKey) {
    return { id: "stripe", name: "Stripe payments", status: "warn", message: "STRIPE_SECRET_KEY is not configured." };
  }

  const response = await fetch("https://api.stripe.com/v1/balance", {
    headers: { Authorization: `Bearer ${secretKey}` },
  });

  if (response.status === 401) {
    return { id: "stripe", name: "Stripe payments", status: "fail", message: "Stripe rejected the API key." };
  }
  if (!response.ok) {
    return { id: "stripe", name: "Stripe payments", status: "warn", message: `Stripe API returned ${response.status}.` };
  }

  return { id: "stripe", name: "Stripe payments", status: "ok", message: "API key accepted; payments are available." };
}

async function checkDiscourse(): Promise<Omit<HealthCheck, "latencyMs">> {
  const baseUrl = (Deno.env.get("DISCOURSE_BASE_URL") || Deno.env.get("DISCOURSE_URL") || "").trim().replace(/\/+$/, "");

  if (!baseUrl) {
    return { id: "discourse", name: "Discourse community", status: "warn", message: "DISCOURSE_BASE_URL is not configured." };
  }

  const response = await fetch(`${baseUrl}/about.json`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    return {
      id: "discourse",
      name: "Discourse community",
      status: response.status >= 500 ? "fail" : "warn",
      message: `Discourse returned ${response.status} for ${baseUrl}/about.json.`,
    };
  }

  return { id: "discourse", name: "Discourse community", status: "ok", message: `Reachable at ${baseUrl}.` };
}

async function checkSlack(): Promise<Omit<HealthCheck, "latencyMs">> {
  const settings = await getAlertSettings();
  const configured = Boolean(settings.slack_webhook_url?.trim() || Deno.env.get("SLACK_ALERT_WEBHOOK_URL")?.trim());

  if (!configured) {
    return {
      id: "slack",
      name: "Slack alerts",
      status: "warn",
      message: "No Slack webhook configured. Set one in Admin → Alerts.",
    };
  }

  return {
    id: "slack",
    name: "Slack alerts",
    status: settings.alerts_enabled ? "ok" : "warn",
    message: settings.alerts_enabled
      ? "Webhook configured and alerting is enabled."
      : "Webhook configured, but alerting is currently disabled.",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const adminCheck = await requireAdmin(req, "health:view");
    if (!adminCheck.actor) {
      return json(adminCheck.status, { ok: false, error: adminCheck.error });
    }

    const checks = await Promise.all([
      timed(checkDatabase),
      timed(checkTables),
      timed(checkResend),
      timed(checkStripe),
      timed(checkDiscourse),
      timed(checkSlack),
    ]);

    const overall: CheckStatus = checks.some((check) => check.status === "fail")
      ? "fail"
      : checks.some((check) => check.status === "warn")
        ? "warn"
        : "ok";

    return json(200, { ok: true, overall, checks, checkedAt: new Date().toISOString() });
  } catch (error) {
    const message = describeError(error);
    console.error("[admin-health-check] error:", message);
    return json(500, { ok: false, error: message });
  }
});
