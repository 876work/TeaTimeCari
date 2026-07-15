// Sends a Web Push notification for a newly created row in `public.notifications`.
//
// This function is invoked by a Supabase Database Webhook (Dashboard > Database >
// Webhooks) configured on INSERT for `public.notifications`, POSTing the standard
// Supabase webhook payload: { type, table, schema, record, old_record }.
// See README.md for the one-time dashboard setup step.
import webpush from "npm:web-push@3.6.7";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

interface NotificationRecord {
  id: string;
  user_id: string;
  type: "new_comment" | "reply" | "green_flag" | "red_flag" | string;
  message: string;
  link: string;
}

interface WebhookPayload {
  type?: string;
  table?: string;
  record?: NotificationRecord;
}

interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

const TITLES: Record<string, string> = {
  new_comment: "New comment on your post",
  reply: "New reply to your comment",
  green_flag: "Your post got a green flag",
  red_flag: "Your post got a red flag",
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isConfigured(): boolean {
  return Boolean(
    Deno.env.get("VAPID_PUBLIC_KEY") &&
      Deno.env.get("VAPID_PRIVATE_KEY") &&
      Deno.env.get("VAPID_SUBJECT"),
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  const expectedSecret = Deno.env.get("PUSH_WEBHOOK_SECRET");
  if (expectedSecret) {
    const providedSecret = req.headers.get("x-webhook-secret");
    if (providedSecret !== expectedSecret) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }
  }

  if (!isConfigured()) {
    console.warn("[send-push-notification] VAPID keys are not configured; skipping push delivery.");
    return new Response(JSON.stringify({ success: true, skipped: "vapid_not_configured" }), {
      status: 200,
      headers: jsonHeaders,
    });
  }

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT")!,
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch (parseError) {
    return new Response(
      JSON.stringify({ success: false, error: `Invalid JSON: ${getErrorMessage(parseError)}` }),
      { status: 400, headers: jsonHeaders },
    );
  }

  const record = payload.record;
  if (!record?.user_id) {
    return new Response(JSON.stringify({ success: false, error: "Missing notification record" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const { data: subscriptions, error: fetchError } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", record.user_id);

  if (fetchError) {
    console.error("[send-push-notification] Failed to load subscriptions:", fetchError);
    return new Response(JSON.stringify({ success: false, error: fetchError.message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  const rows = (subscriptions ?? []) as PushSubscriptionRow[];

  if (rows.length === 0) {
    return new Response(JSON.stringify({ success: true, sent: 0, failed: 0, removed: 0 }), {
      headers: jsonHeaders,
    });
  }

  const messageBody = JSON.stringify({
    title: TITLES[record.type] ?? "Tea Time Cari",
    body: record.message,
    url: record.link || "/",
    tag: record.id,
  });

  let sent = 0;
  let failed = 0;
  const staleSubscriptionIds: string[] = [];

  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          messageBody,
        );
        sent += 1;
      } catch (err: unknown) {
        failed += 1;
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          staleSubscriptionIds.push(row.id);
        } else {
          console.error("[send-push-notification] Delivery failed:", getErrorMessage(err));
        }
      }
    }),
  );

  if (staleSubscriptionIds.length > 0) {
    await supabaseAdmin.from("push_subscriptions").delete().in("id", staleSubscriptionIds);
  }

  return new Response(
    JSON.stringify({ success: true, sent, failed, removed: staleSubscriptionIds.length }),
    { headers: jsonHeaders },
  );
});
