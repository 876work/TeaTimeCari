import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";
import { describeError, isMissingTableError } from "../_shared/pgErrors.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type PaymentRow = {
  id: string;
  user_id: string;
  stripe_payment_intent_id: string;
  feed_access: string;
  amount: number;
  currency: string;
  status: string;
  expires_at: string | null;
  created_at: string;
};

const SUCCESS_STATUSES = new Set(["succeeded", "paid", "complete", "completed"]);
const FAILED_STATUSES = new Set(["failed", "canceled", "cancelled", "requires_payment_method"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const adminCheck = await requireAdmin(req, "payments:view");
    if (!adminCheck.actor) {
      return json(adminCheck.status, { ok: false, error: adminCheck.error });
    }

    let limit = 200;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({})) as { limit?: unknown };
      const requested = typeof body.limit === "number" ? body.limit : Number(body.limit);
      if (Number.isFinite(requested)) {
        limit = Math.min(Math.max(Math.floor(requested), 1), 1000);
      }
    }

    const { data: payments, error, count } = await supabaseAdmin
      .from("payments")
      .select("id, user_id, stripe_payment_intent_id, feed_access, amount, currency, status, expires_at, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      if (isMissingTableError(error)) {
        return json(200, {
          ok: true,
          payments: [],
          total: 0,
          summary: null,
          tableMissing: true,
        });
      }
      throw error;
    }

    const rows = (payments ?? []) as PaymentRow[];

    // Attach user email/username where available so admins can identify payers.
    const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
    const emailById = new Map<string, { email: string | null; username: string | null }>();

    if (userIds.length > 0) {
      const { data: registrations, error: regError } = await supabaseAdmin
        .from("registrations")
        .select("id, email, username")
        .in("id", userIds);

      if (!regError) {
        for (const reg of registrations ?? []) {
          emailById.set(reg.id, { email: reg.email ?? null, username: reg.username ?? null });
        }
      }
    }

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const last30 = now - 30 * dayMs;
    const prior30 = now - 60 * dayMs;

    const succeeded = rows.filter((row) => SUCCESS_STATUSES.has(row.status?.toLowerCase()));
    const failed = rows.filter((row) => FAILED_STATUSES.has(row.status?.toLowerCase()));

    const sum = (list: PaymentRow[]) => list.reduce((total, row) => total + (row.amount || 0), 0);

    const revenue30 = sum(succeeded.filter((row) => new Date(row.created_at).getTime() >= last30));
    const revenuePrior30 = sum(
      succeeded.filter((row) => {
        const at = new Date(row.created_at).getTime();
        return at >= prior30 && at < last30;
      }),
    );

    const activeAccess = succeeded.filter(
      (row) => row.expires_at && new Date(row.expires_at).getTime() > now,
    ).length;

    // Daily revenue buckets for the last 30 days (amounts in cents).
    const revenueByDay: Array<{ date: string; amount: number; count: number }> = [];
    for (let index = 29; index >= 0; index -= 1) {
      const day = new Date(now - index * dayMs);
      day.setHours(0, 0, 0, 0);
      const next = day.getTime() + dayMs;
      const daily = succeeded.filter((row) => {
        const at = new Date(row.created_at).getTime();
        return at >= day.getTime() && at < next;
      });
      revenueByDay.push({
        date: day.toISOString().split("T")[0],
        amount: sum(daily),
        count: daily.length,
      });
    }

    return json(200, {
      ok: true,
      total: count ?? rows.length,
      currency: rows[0]?.currency ?? "usd",
      payments: rows.map((row) => ({
        ...row,
        email: emailById.get(row.user_id)?.email ?? null,
        username: emailById.get(row.user_id)?.username ?? null,
      })),
      summary: {
        totalRevenue: sum(succeeded),
        revenue30,
        revenuePrior30,
        succeededCount: succeeded.length,
        failedCount: failed.length,
        pendingCount: rows.length - succeeded.length - failed.length,
        activeAccess,
        revenueByDay,
      },
    });
  } catch (error) {
    const message = describeError(error);
    console.error("[get-admin-payments] error:", message);
    return json(500, { ok: false, error: message });
  }
});
