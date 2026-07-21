import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { requireAdmin, writeAdminAuditLog } from "../_shared/adminAuth.ts";
import { isMissingTableError } from "../_shared/pgErrors.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Placement = "homepage" | "in_feed" | "footer";
type DeviceTarget = "all" | "desktop" | "mobile";

type RequestBody = {
  action?: "list" | "create" | "update" | "set-active" | "delete" | "stats";
  ad_id?: string;
  title?: string;
  advertiser_name?: string;
  image_path?: string;
  image_width?: number;
  image_height?: number;
  destination_url?: string;
  alt_text?: string;
  placement?: string;
  device_target?: string;
  priority?: number;
  starts_at?: string | null;
  ends_at?: string | null;
  active?: boolean;
  days?: number;
};

const PLACEMENTS = new Set<Placement>(["homepage", "in_feed", "footer"]);
const DEVICE_TARGETS = new Set<DeviceTarget>(["all", "desktop", "mobile"]);

const TABLE_MISSING_MESSAGE =
  "The advertisements table doesn't exist yet. Ask an engineer to run the pending database migration (supabase/migrations/20260721000000_advertising_system.sql) before ads can be created.";

function missingTableResponse() {
  return json(409, { ok: false, error: TABLE_MISSING_MESSAGE, tableMissing: true });
}

function validateDestinationUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "Destination URL must start with http:// or https://.";
    }
    return null;
  } catch {
    return "Destination URL is not a valid URL.";
  }
}

async function listAds() {
  const { data, error } = await supabaseAdmin
    .from("advertisements")
    .select("*")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    if (isMissingTableError(error)) return { advertisements: [], tableMissing: true };
    throw error;
  }

  return { advertisements: data ?? [], tableMissing: false };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const adminCheck = await requireAdmin(req, "ads:manage");
    if (!adminCheck.actor) {
      return json(adminCheck.status, { ok: false, error: adminCheck.error });
    }
    const actor = adminCheck.actor;

    const body = req.method === "POST"
      ? (await req.json().catch(() => ({}))) as RequestBody
      : {} as RequestBody;
    const action = body.action ?? "list";

    if (action === "list") {
      const { advertisements, tableMissing } = await listAds();
      return json(200, { ok: true, advertisements, tableMissing });
    }

    if (action === "create") {
      const title = (body.title ?? "").trim();
      const advertiserName = (body.advertiser_name ?? "").trim();
      const imagePath = (body.image_path ?? "").trim();
      const destinationUrl = (body.destination_url ?? "").trim();
      const altText = (body.alt_text ?? "").trim();
      const placement = PLACEMENTS.has(body.placement as Placement)
        ? (body.placement as Placement)
        : null;
      const deviceTarget = DEVICE_TARGETS.has(body.device_target as DeviceTarget)
        ? (body.device_target as DeviceTarget)
        : "all";
      const priority = Number.isFinite(body.priority) ? Math.trunc(Number(body.priority)) : 0;

      if (!title) return json(400, { ok: false, error: "Title is required." });
      if (!imagePath) return json(400, { ok: false, error: "A banner image is required." });
      if (!destinationUrl) return json(400, { ok: false, error: "Destination URL is required." });
      if (!placement) return json(400, { ok: false, error: "A valid placement is required." });

      const urlError = validateDestinationUrl(destinationUrl);
      if (urlError) return json(400, { ok: false, error: urlError });

      const startsAt = body.starts_at ? new Date(body.starts_at) : new Date();
      const endsAt = body.ends_at ? new Date(body.ends_at) : null;

      if (Number.isNaN(startsAt.getTime())) {
        return json(400, { ok: false, error: "Start date is invalid." });
      }
      if (endsAt && Number.isNaN(endsAt.getTime())) {
        return json(400, { ok: false, error: "End date is invalid." });
      }
      if (endsAt && endsAt <= startsAt) {
        return json(400, { ok: false, error: "End date must be after the start date." });
      }

      const { data: created, error } = await supabaseAdmin
        .from("advertisements")
        .insert({
          title,
          advertiser_name: advertiserName || null,
          image_path: imagePath,
          image_width: body.image_width ?? null,
          image_height: body.image_height ?? null,
          destination_url: destinationUrl,
          alt_text: altText || null,
          placement,
          device_target: deviceTarget,
          priority,
          active: body.active !== false,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt ? endsAt.toISOString() : null,
          created_by: actor.userId,
          created_by_email: actor.email,
        })
        .select()
        .single();

      if (error) {
        if (isMissingTableError(error)) return missingTableResponse();
        throw error;
      }

      await writeAdminAuditLog({
        actor,
        req,
        action: "ad_created",
        targetType: "advertisement",
        targetId: created.id,
        metadata: { title, placement, priority },
      });

      const { advertisements } = await listAds();
      return json(200, { ok: true, advertisement: created, advertisements });
    }

    if (action === "update") {
      if (!body.ad_id) return json(400, { ok: false, error: "ad_id is required." });

      const { data: current, error: readError } = await supabaseAdmin
        .from("advertisements")
        .select("id, title, image_path")
        .eq("id", body.ad_id)
        .maybeSingle();

      if (readError) {
        if (isMissingTableError(readError)) return missingTableResponse();
        throw readError;
      }
      if (!current) return json(404, { ok: false, error: "Advertisement not found." });

      const updates: Record<string, unknown> = {};

      if (body.title !== undefined) {
        const title = body.title.trim();
        if (!title) return json(400, { ok: false, error: "Title is required." });
        updates.title = title;
      }
      if (body.advertiser_name !== undefined) {
        updates.advertiser_name = body.advertiser_name.trim() || null;
      }
      if (body.image_path !== undefined && body.image_path.trim()) {
        updates.image_path = body.image_path.trim();
        updates.image_width = body.image_width ?? null;
        updates.image_height = body.image_height ?? null;
      }
      if (body.destination_url !== undefined) {
        const destinationUrl = body.destination_url.trim();
        if (!destinationUrl) return json(400, { ok: false, error: "Destination URL is required." });
        const urlError = validateDestinationUrl(destinationUrl);
        if (urlError) return json(400, { ok: false, error: urlError });
        updates.destination_url = destinationUrl;
      }
      if (body.alt_text !== undefined) {
        updates.alt_text = body.alt_text.trim() || null;
      }
      if (body.placement !== undefined) {
        if (!PLACEMENTS.has(body.placement as Placement)) {
          return json(400, { ok: false, error: "A valid placement is required." });
        }
        updates.placement = body.placement;
      }
      if (body.device_target !== undefined) {
        if (!DEVICE_TARGETS.has(body.device_target as DeviceTarget)) {
          return json(400, { ok: false, error: "A valid device target is required." });
        }
        updates.device_target = body.device_target;
      }
      if (body.priority !== undefined) {
        updates.priority = Number.isFinite(body.priority) ? Math.trunc(Number(body.priority)) : 0;
      }
      if (body.active !== undefined) {
        updates.active = Boolean(body.active);
      }
      if (body.starts_at !== undefined) {
        const startsAt = body.starts_at ? new Date(body.starts_at) : new Date();
        if (Number.isNaN(startsAt.getTime())) {
          return json(400, { ok: false, error: "Start date is invalid." });
        }
        updates.starts_at = startsAt.toISOString();
      }
      if (body.ends_at !== undefined) {
        const endsAt = body.ends_at ? new Date(body.ends_at) : null;
        if (endsAt && Number.isNaN(endsAt.getTime())) {
          return json(400, { ok: false, error: "End date is invalid." });
        }
        updates.ends_at = endsAt ? endsAt.toISOString() : null;
      }

      const { error } = await supabaseAdmin
        .from("advertisements")
        .update(updates)
        .eq("id", body.ad_id);

      if (error) {
        if (isMissingTableError(error)) return missingTableResponse();
        throw error;
      }

      await writeAdminAuditLog({
        actor,
        req,
        action: "ad_updated",
        targetType: "advertisement",
        targetId: body.ad_id,
        metadata: { fields: Object.keys(updates) },
      });

      const { advertisements } = await listAds();
      return json(200, { ok: true, advertisements });
    }

    if (action === "set-active") {
      if (!body.ad_id) return json(400, { ok: false, error: "ad_id is required." });

      const { data: current, error: readError } = await supabaseAdmin
        .from("advertisements")
        .select("id, title, active")
        .eq("id", body.ad_id)
        .maybeSingle();

      if (readError) {
        if (isMissingTableError(readError)) return missingTableResponse();
        throw readError;
      }
      if (!current) return json(404, { ok: false, error: "Advertisement not found." });

      const { error } = await supabaseAdmin
        .from("advertisements")
        .update({ active: !current.active })
        .eq("id", current.id);

      if (error) {
        if (isMissingTableError(error)) return missingTableResponse();
        throw error;
      }

      await writeAdminAuditLog({
        actor,
        req,
        action: current.active ? "ad_deactivated" : "ad_activated",
        targetType: "advertisement",
        targetId: current.id,
        metadata: { title: current.title },
      });

      const { advertisements } = await listAds();
      return json(200, { ok: true, advertisements });
    }

    if (action === "delete") {
      if (!body.ad_id) return json(400, { ok: false, error: "ad_id is required." });

      const { data: current, error: readError } = await supabaseAdmin
        .from("advertisements")
        .select("id, title, image_path")
        .eq("id", body.ad_id)
        .maybeSingle();

      if (readError) {
        if (isMissingTableError(readError)) return missingTableResponse();
        throw readError;
      }
      if (!current) return json(404, { ok: false, error: "Advertisement not found." });

      const { error } = await supabaseAdmin
        .from("advertisements")
        .delete()
        .eq("id", body.ad_id);

      if (error) {
        if (isMissingTableError(error)) return missingTableResponse();
        throw error;
      }

      if (current.image_path) {
        await supabaseAdmin.storage.from("ad-creatives").remove([current.image_path]).catch(() => {
          // Best-effort cleanup; the DB row is already gone.
        });
      }

      await writeAdminAuditLog({
        actor,
        req,
        action: "ad_deleted",
        targetType: "advertisement",
        targetId: body.ad_id,
        metadata: { title: current.title },
      });

      const { advertisements } = await listAds();
      return json(200, { ok: true, advertisements });
    }

    if (action === "stats") {
      const days = Number.isFinite(body.days) && Number(body.days) > 0 ? Math.trunc(Number(body.days)) : 30;
      const since = new Date();
      since.setDate(since.getDate() - (days - 1));
      since.setHours(0, 0, 0, 0);

      const { advertisements } = await listAds();

      const [{ data: impressions, error: impError }, { data: clicks, error: clickError }] = await Promise.all([
        supabaseAdmin
          .from("ad_impressions")
          .select("ad_id, placement, device, created_at")
          .gte("created_at", since.toISOString()),
        supabaseAdmin
          .from("ad_clicks")
          .select("ad_id, placement, device, created_at")
          .gte("created_at", since.toISOString()),
      ]);

      if (impError && !isMissingTableError(impError)) throw impError;
      if (clickError && !isMissingTableError(clickError)) throw clickError;

      const totalImpressions = advertisements.reduce(
        (sum: number, ad: { impression_count?: number }) => sum + (ad.impression_count ?? 0),
        0,
      );
      const totalClicks = advertisements.reduce(
        (sum: number, ad: { click_count?: number }) => sum + (ad.click_count ?? 0),
        0,
      );

      const byDay: Record<string, { impressions: number; clicks: number }> = {};
      for (const row of impressions ?? []) {
        const day = String(row.created_at).slice(0, 10);
        byDay[day] = byDay[day] ?? { impressions: 0, clicks: 0 };
        byDay[day].impressions += 1;
      }
      for (const row of clicks ?? []) {
        const day = String(row.created_at).slice(0, 10);
        byDay[day] = byDay[day] ?? { impressions: 0, clicks: 0 };
        byDay[day].clicks += 1;
      }

      const byPlacement: Record<string, { impressions: number; clicks: number }> = {};
      for (const row of impressions ?? []) {
        const key = row.placement ?? "unknown";
        byPlacement[key] = byPlacement[key] ?? { impressions: 0, clicks: 0 };
        byPlacement[key].impressions += 1;
      }
      for (const row of clicks ?? []) {
        const key = row.placement ?? "unknown";
        byPlacement[key] = byPlacement[key] ?? { impressions: 0, clicks: 0 };
        byPlacement[key].clicks += 1;
      }

      const bestAd = [...advertisements]
        .sort((a: { click_count?: number }, b: { click_count?: number }) => (b.click_count ?? 0) - (a.click_count ?? 0))
        .find((ad: { click_count?: number }) => (ad.click_count ?? 0) > 0) ?? null;

      const bestPlacementEntry = Object.entries(byPlacement).sort(
        (a, b) => b[1].clicks - a[1].clicks,
      )[0];

      return json(200, {
        ok: true,
        totalImpressions,
        totalClicks,
        ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
        bestAd: bestAd ? { id: bestAd.id, title: bestAd.title, clicks: bestAd.click_count } : null,
        bestPlacement: bestPlacementEntry ? { placement: bestPlacementEntry[0], clicks: bestPlacementEntry[1].clicks } : null,
        byDay: Object.entries(byDay)
          .sort((a, b) => (a[0] < b[0] ? -1 : 1))
          .map(([date, counts]) => ({ date, ...counts })),
        byPlacement,
      });
    }

    return json(400, { ok: false, error: `Unknown action: ${action}` });
  } catch (error) {
    console.error("admin-ads error", error);
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return json(500, { ok: false, error: message });
  }
});
