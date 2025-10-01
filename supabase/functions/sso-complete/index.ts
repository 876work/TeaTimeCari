// supabase/functions/sso-complete/index.ts
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { signSsoPayload, buildDiscourseGroups } from "../_shared/sso.ts";

const SECRET = Deno.env.get("DISCOURSE_SSO_SECRET")!;
const DISCOURSE_BASE_URL =
  Deno.env.get("DISCOURSE_BASE_URL") || "https://community.teatimecari.app";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    let nonce: string | null = null;
    let returnUrl: string | null = null;

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      nonce = body?.nonce ?? body?.sso_nonce ?? null;
      returnUrl =
        body?.returnUrl ??
        body?.r ??
        `${DISCOURSE_BASE_URL.replace(/\/+$/, "")}/session/sso_login`;
    } else if (req.method === "GET") {
      const u = new URL(req.url);
      nonce = u.searchParams.get("sso_nonce");
      returnUrl =
        u.searchParams.get("r") ??
        `${DISCOURSE_BASE_URL.replace(/\/+$/, "")}/session/sso_login`;
    } else {
      return json(405, { error: "Method not allowed" });
    }

    if (!SECRET) return json(500, { error: "Server config missing SSO secret" });
    if (!nonce) return json(400, { error: "missing nonce" });

    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return json(401, { error: "missing token" });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return json(401, { error: "unauthorized" });

    const { data: profile, error: pErr } = await supabaseAdmin
      .from("registrations")
      .select("*")
      .eq("id", user.id)
      .single();
    if (pErr || !profile) return json(403, { error: "profile not found" });
    if (profile.status !== "approved") {
      return json(200, { redirectUrl: "https://teatimecari.app/kyc-pending" });
    }

    const gender = (profile.gender || "").toString().toLowerCase() === "male" ? "men" : "women";
    const addGroups = buildDiscourseGroups(gender, /* xaccess */ false);

    const payload = {
      nonce,
      external_id: profile.id,
      email: profile.email,
      username: profile.username || (user.email ?? "").split("@")[0] || "user",
      name:
        profile.fullName ||
        [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
        profile.username ||
        "",
      add_groups: addGroups,
      require_activation: false,
    };

    const { b64, sig } = await signSsoPayload(payload, SECRET);
    const redirectUrl = `${returnUrl}?sso=${encodeURIComponent(b64)}&sig=${sig}`;
    return json(200, { redirectUrl });
  } catch (e) {
    console.error("[sso-complete] error:", e);
    return json(500, { error: "internal error" });
  }
});