// supabase/functions/sso-complete/index.ts
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { signSsoPayload, buildDiscourseGroups, parseAndVerifyIncoming } from "../_shared/sso.ts";

const SECRET = Deno.env.get("DISCOURSE_SSO_SECRET")!;
const DISCOURSE_BASE_URL =
  Deno.env.get("DISCOURSE_BASE_URL") || "https://community.teatimecari.app";

const baseHeaders = { ...corsHeaders, "Content-Type": "application/json", "Vary": "Origin" };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: baseHeaders });
}

function safeReturnUrl(input?: string | null) {
  const fallback = `${DISCOURSE_BASE_URL.replace(/\/+$/, "")}/session/sso_login`;
  if (!input) return fallback;
  try {
    const want = new URL(input);
    const base = new URL(DISCOURSE_BASE_URL);
    if (want.origin !== base.origin) return fallback;
    if (!want.pathname.startsWith("/session/sso_login")) return fallback;
    return `${base.origin}${want.pathname}${want.search}`;
  } catch {
    return fallback;
  }
}

function sanitizeUsername(u: string) {
  return (u || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]/g, "_")
    .slice(0, 25) || "user";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: baseHeaders });
  try {
    let nonce: string | null = null;
    let returnUrlRaw: string | null = null;

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));

      const sso = body?.sso ?? null;
      const sig = body?.sig ?? null;

      if (sso && sig) {
        if (!SECRET) return json(500, { error: "Server config missing SSO secret" });
        const params = await parseAndVerifyIncoming(sso, sig, SECRET);
        nonce = params.get("nonce");
        returnUrlRaw = params.get("return_sso_url");
      } else {
        // Backwards compatibility with existing format.
        nonce = body?.nonce ?? body?.sso_nonce ?? null;
        returnUrlRaw = body?.returnUrl ?? body?.r ?? null;
      }
    } else if (req.method === "GET") {
      const u = new URL(req.url);
      nonce = u.searchParams.get("sso_nonce");
      returnUrlRaw = u.searchParams.get("r");
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

    const genderVal = (profile.gender || "").toString().toLowerCase();
    const gender = genderVal === "male" ? "men" : "women";
    const addGroups = buildDiscourseGroups(gender, /* xaccess */ false);

    const derivedUsername =
      profile.username ||
      sanitizeUsername((user.email ?? "").split("@")[0] || "");

    const name =
      profile.fullName ||
      [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
      derivedUsername;

    const payload = {
      nonce,
      external_id: profile.id,
      email: profile.email,
      username: derivedUsername,
      name,
      add_groups: addGroups,
      require_activation: false,
    };

    const { b64, sig } = await signSsoPayload(payload, SECRET);
    const returnUrl = safeReturnUrl(returnUrlRaw);
    const redirectUrl = `${returnUrl}?sso=${encodeURIComponent(b64)}&sig=${sig}`;

    return json(200, { redirectUrl });
  } catch (e) {
    console.error("[sso-complete] error:", e);
    return json(500, { error: "internal error" });
  }
});
