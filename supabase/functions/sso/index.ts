import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { parseAndVerifyIncoming, signSsoPayload, buildDiscourseGroups } from "../_shared/sso.ts";

const DISCOURSE_BASE_URL = Deno.env.get("DISCOURSE_BASE_URL") || "https://community.teatimecari.app";
const SITE_BASE_URL = Deno.env.get("SITE_BASE_URL") || "https://teatimecari.app";
const DEFAULT_RETURN_PATH = Deno.env.get("DISCOURSE_DEFAULT_RETURN_PATH") || "/";
const MEN_CATEGORY_PATH = Deno.env.get("DISCOURSE_MEN_CATEGORY_PATH") || "/c/user-photos/men-photos-slu/6";
const WOMEN_CATEGORY_PATH = Deno.env.get("DISCOURSE_WOMEN_CATEGORY_PATH") || "/c/user-photos/women-photos-slu/7";

type CommunityGender = "men" | "women";

function redirect(location: string) {
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      Location: location,
    },
  });
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

function generateNonce() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getAuthToken(req: Request, url: URL) {
  const authHeader = req.headers.get("Authorization");
  const tokenFromQuery = url.searchParams.get("token");

  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  return tokenFromQuery || null;
}

async function getApprovedProfile(token: string) {
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return { user: null, profile: null, response: redirect(`${SITE_BASE_URL}/login?redirectTo=/community`) };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("registrations")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.status !== "approved") {
    return { user, profile: null, response: redirect(`${SITE_BASE_URL}/kyc-pending`) };
  }

  return { user, profile, response: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "GET") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const discourseSsoSecret = Deno.env.get("DISCOURSE_SSO_SECRET");

    if (!discourseSsoSecret) {
      console.error("Missing DISCOURSE_SSO_SECRET");
      return new Response("Server configuration error", { status: 500, headers: corsHeaders });
    }

    const url = new URL(req.url);
    const sso = url.searchParams.get("sso");
    const sig = url.searchParams.get("sig");
    let nonce = generateNonce();
    let returnSsoUrl: string | null = null;

    if (sso && sig) {
      const incomingParams = await parseAndVerifyIncoming(sso, sig, discourseSsoSecret);
      nonce = incomingParams.get("nonce") || "";
      returnSsoUrl = incomingParams.get("return_sso_url");

      if (!nonce || !returnSsoUrl) {
        const html = `<!doctype html><html><head><meta charset="utf-8" /><title>Sign-in link issue | Tea Time Cari</title></head><body style="margin:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#F4FBFF; color:#1f2937; display:flex; align-items:center; justify-content:center; min-height:100vh;"><div style="max-width:420px; padding:32px; text-align:center;"><h1 style="font-size:20px; margin:0 0 12px;">This sign-in link isn't valid</h1><p style="color:#4b5563; line-height:1.6; margin:0 0 24px;">The community sign-in link is missing required details. Please return to Tea Time Cari and try again.</p><a href="${SITE_BASE_URL}/community" style="display:inline-block; background:#4B9EC8; color:#ffffff; padding:12px 20px; border-radius:10px; text-decoration:none; font-weight:600;">Return to Tea Time Cari</a></div></body></html>`;
        return new Response(html, {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
        });
      }
    }

    const token = getAuthToken(req, url);

    if (!token) {
      return redirect(`${SITE_BASE_URL}/login?redirectTo=/community`);
    }

    const { profile, response } = await getApprovedProfile(token);

    if (response) return response;
    if (!profile) return redirect(`${SITE_BASE_URL}/kyc-pending`);

    const communityGender = normalizeCommunityGender(profile.gender) || "women";
    const returnPath = getReturnPathForGender(profile.gender);
    const groups = buildDiscourseGroups(communityGender, false);
    const username = profile.username || (profile.email || "user").split("@")[0];

    const responsePayload: Record<string, string> = {
      nonce,
      external_id: profile.id,
      email: profile.email,
      username,
      // Do not sync legal/full names into Discourse display fields; the public
      // community identity is the member-selected username.
      name: username,
      add_groups: groups,
    };

    const { b64, sig: responseSig } = await signSsoPayload(responsePayload, discourseSsoSecret);

    if (returnSsoUrl) {
      return redirect(buildDiscourseSsoRedirect(returnSsoUrl, returnPath, b64, responseSig));
    }

    const discourseLoginUrl = new URL(`${DISCOURSE_BASE_URL.replace(/\/+$/, "")}/session/sso_login`);
    discourseLoginUrl.searchParams.set("return_path", returnPath);
    discourseLoginUrl.searchParams.set("sso", b64);
    discourseLoginUrl.searchParams.set("sig", responseSig);
    return redirect(discourseLoginUrl.toString());
  } catch (err) {
    console.error("[sso] Error:", err instanceof Error ? err.message : err);
    return new Response(
      JSON.stringify({ error: "SSO processing failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
