import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { isMissingTableError } from "../_shared/pgErrors.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type RequestBody = {
  ad_id?: string;
  placement?: string;
  session_id?: string;
  device?: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const adId = (body.ad_id ?? "").trim();
    const placement = (body.placement ?? "unknown").trim().slice(0, 40);
    const sessionId = (body.session_id ?? "").trim().slice(0, 100) || null;
    const device = (body.device ?? "unknown").trim().slice(0, 20);

    if (!adId) return json(400, { ok: false, error: "ad_id is required." });

    // Only count clicks for ads that are actually eligible right now — guards
    // the counter against stale client state and arbitrary ad ids.
    const { data: ad, error: adError } = await supabaseAdmin
      .from("advertisements")
      .select("id, active, starts_at, ends_at")
      .eq("id", adId)
      .maybeSingle();

    if (adError) {
      if (isMissingTableError(adError)) return json(200, { ok: true, recorded: false });
      throw adError;
    }
    if (!ad || !ad.active) return json(200, { ok: true, recorded: false });

    const now = new Date();
    if (new Date(ad.starts_at) > now) return json(200, { ok: true, recorded: false });
    if (ad.ends_at && new Date(ad.ends_at) <= now) return json(200, { ok: true, recorded: false });

    let isUnique = true;
    if (sessionId) {
      const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabaseAdmin
        .from("ad_clicks")
        .select("id", { count: "exact", head: true })
        .eq("ad_id", adId)
        .eq("session_id", sessionId)
        .gte("created_at", since);
      isUnique = !count || count === 0;
    }

    await supabaseAdmin.from("ad_clicks").insert({
      ad_id: adId,
      placement,
      session_id: sessionId,
      device,
      is_unique: isUnique,
    });

    const { error: rpcError } = await supabaseAdmin.rpc("increment_ad_click_count", { p_ad_id: adId });
    if (rpcError) console.warn("increment_ad_click_count failed", rpcError);

    return json(200, { ok: true, recorded: true });
  } catch (error) {
    console.error("ad-click error", error);
    return json(200, { ok: false, error: "Unable to record click." });
  }
});
