import { supabaseAdmin } from "./supabaseAdmin.ts";

export type SlackSendResult = {
  success: boolean;
  error?: string;
};

export type AlertSettings = {
  alerts_enabled: boolean;
  slack_webhook_url: string | null;
  pending_users_threshold: number;
  flagged_posts_threshold: number;
  notify_on_new_registration: boolean;
  notify_on_high_risk_post: boolean;
  notify_on_payment_failure: boolean;
};

const SETTINGS_DEFAULTS: AlertSettings = {
  alerts_enabled: false,
  slack_webhook_url: null,
  pending_users_threshold: 5,
  flagged_posts_threshold: 3,
  notify_on_new_registration: false,
  notify_on_high_risk_post: true,
  notify_on_payment_failure: true,
};

export async function getAlertSettings(): Promise<AlertSettings> {
  const { data, error } = await supabaseAdmin
    .from("admin_alert_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) return { ...SETTINGS_DEFAULTS };

  return { ...SETTINGS_DEFAULTS, ...data };
}

function resolveWebhookUrl(settings?: AlertSettings | null): string | null {
  const configured = settings?.slack_webhook_url?.trim();
  if (configured) return configured;

  return Deno.env.get("SLACK_ALERT_WEBHOOK_URL")?.trim() || null;
}

export async function sendSlackMessage(
  text: string,
  options: {
    settings?: AlertSettings | null;
    blocks?: unknown[];
  } = {},
): Promise<SlackSendResult> {
  const webhookUrl = resolveWebhookUrl(options.settings);

  if (!webhookUrl) {
    return { success: false, error: "No Slack webhook URL configured." };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        options.blocks ? { text, blocks: options.blocks } : { text },
      ),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        success: false,
        error: `Slack webhook error (${response.status})${body ? `: ${body.slice(0, 200)}` : ""}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function logAlertEvent(input: {
  alertType: string;
  message: string;
  payload?: Record<string, unknown>;
  success: boolean;
  errorMessage?: string | null;
}) {
  const { error } = await supabaseAdmin.from("admin_alert_events").insert({
    alert_type: input.alertType,
    message: input.message,
    payload: input.payload ?? {},
    success: input.success,
    error_message: input.errorMessage ?? null,
  });

  if (error) {
    console.warn("Unable to write admin alert event", error);
  }
}

export async function sendAndLogAlert(input: {
  alertType: string;
  message: string;
  payload?: Record<string, unknown>;
  settings?: AlertSettings | null;
}): Promise<SlackSendResult> {
  const settings = input.settings ?? (await getAlertSettings());
  const result = await sendSlackMessage(input.message, { settings });

  await logAlertEvent({
    alertType: input.alertType,
    message: input.message,
    payload: input.payload,
    success: result.success,
    errorMessage: result.error ?? null,
  });

  return result;
}
