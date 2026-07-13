// supabase/functions/sso-complete/index.ts
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { signSsoPayload, buildDiscourseGroups, parseAndVerifyIncoming } from "../_shared/sso.ts";

const SECRET = Deno.env.get("DISCOURSE_SSO_SECRET")!;
const DISCOURSE_BASE_URL =
  Deno.env.get("DISCOURSE_BASE_URL") || "https://community.teatimecari.app";
const SITE_BASE_URL =
  Deno.env.get("SITE_BASE_URL") || "https://teatimecari.app";
const DEFAULT_RETURN_PATH = Deno.env.get("DISCOURSE_DEFAULT_RETURN_PATH") || "/";
const MEN_CATEGORY_PATH = Deno.env.get("DISCOURSE_MEN_CATEGORY_PATH") || "/c/user-photos/men-photos-slu/6";
const WOMEN_CATEGORY_PATH = Deno.env.get("DISCOURSE_WOMEN_CATEGORY_PATH") || "/c/user-photos/women-photos-slu/7";

const baseHeaders = { ...corsHeaders, "Content-Type": "application/json", "Vary": "Origin" };

type CommunityGender = "men" | "women";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: baseHeaders });
}

function normalizeReturnPath(pathOrUrl: string) {
  try {
    const base = new URL(DISCOURSE_BASE_URL);
    const url = new URL(pathOrUrl, base.origin);

    if (url.origin !== base.origin) {
      return DEFAULT_RETURN_PATH;
    }

    return `${url.pathname}${url.search}${url.hash}` || DEFAULT_RETURN_PATH;
  } catch {
    return DEFAULT_RETURN_PATH;
  }
}

function normalizeCommunityGender(gender?: string | null): CommunityGender | null {
  const normalized = gender?.trim().toLowerCase();

  if (normalized === "male" || normalized === "men") return "men";
  if (normalized === "female" || normalized === "women") return "women";

  return null;
}

function getReturnPathForGender(gender?: string | null) {
  const communityGender = normalizeCommunityGender(gender);

  if (communityGender === "men") return normalizeReturnPath(MEN_CATEGORY_PATH);
  if (communityGender === "women") return normalizeReturnPath(WOMEN_CATEGORY_PATH);

  return normalizeReturnPath(DEFAULT_RETURN_PATH);
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

function buildDiscourseSsoRedirect(returnUrlRaw: string | null, returnPath: string, sso: string, sig: string) {
  const returnUrl = new URL(safeReturnUrl(returnUrlRaw));
  returnUrl.searchParams.set("return_path", returnPath);
  returnUrl.searchParams.set("sso", sso);
  returnUrl.searchParams.set("sig", sig);
  return returnUrl.toString();
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
      .maybeSingle();

    // Missing row or non-approved status should route to KYC pending.
    // Only real database/permission failures should return an error.
    if (pErr) return json(500, { error: "registration lookup failed" });
    if (!profile || !profile.status || profile.status !== "approved") {
      const pendingUrl = `${SITE_BASE_URL.replace(/\/+$/, "")}/kyc-pending`;
      return json(200, { redirectUrl: pendingUrl });
    }

    const communityGender = normalizeCommunityGender(profile.gender);

    if (!communityGender) {
      console.error("[sso-complete] Unrecognized gender on approved profile:", profile.id);
      return json(422, { error: "unrecognized_gender" });
    }

    const addGroups = buildDiscourseGroups(communityGender, /* xaccess */ false);
    const returnPath = getReturnPathForGender(profile.gender);

    const derivedUsername =
      profile.username ||
      sanitizeUsername((user.email ?? "").split("@")[0] || "");

    // Keep external_id stable forever: DiscourseConnect associates users by this value.
    // Do not sync legal/full names into Discourse display fields; the public
    // community identity is the member-selected username.
    const payload = {
      nonce,
      external_id: profile.id,
      email: profile.email,
      username: derivedUsername,
      name: derivedUsername,
      add_groups: addGroups,
      require_activation: "false",
    };

    const { b64, sig } = await signSsoPayload(payload, SECRET);
    const redirectUrl = buildDiscourseSsoRedirect(returnUrlRaw, returnPath, b64, sig);

    return json(200, { redirectUrl });
  } catch (e) {
    console.error("[sso-complete] error:", e);
    return json(500, { error: "internal error" });
  }
});
