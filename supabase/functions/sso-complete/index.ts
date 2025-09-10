// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ---------- ENV ---------- */
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DISCOURSE_BASE = (Deno.env.get("DISCOURSE_BASE_URL") || "").replace(/\/+$/, "");
const DISCOURSE_SSO_SECRET = Deno.env.get("DISCOURSE_SSO_SECRET")!;
const XACCESS_GROUP  = (Deno.env.get("XACCESS_GROUP") || "").trim();

/* ---------- helpers ---------- */
function bad(status: number, msg: string) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
}
function ok(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
}
async function hmacHex(input: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}
function b64Decode(str: string) {
  try { return new TextDecoder().decode(Uint8Array.from(atob(str), c => c.charCodeAt(0))); }
  catch { return ""; }
}

/* ---------- handler ---------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type" }});
  }
  if (req.method !== "POST") return bad(405, "Method not allowed");

  const url = new URL(req.url);
  const isJson = req.headers.get("content-type")?.includes("application/json");
  const input = isJson ? await req.json().catch(() => ({} as any)) : Object.fromEntries(url.searchParams);

  const sso = (input.sso || "").toString();
  const sig = (input.sig || "").toString();
  if (!sso || !sig) return bad(400, "Missing sso/sig");

  // verify incoming signature from Discourse
  const want = await hmacHex(sso, DISCOURSE_SSO_SECRET);
  if (want !== sig) return bad(400, "Invalid SSO signature");

  // decode payload; we need nonce + return_sso_url
  const decoded = new URLSearchParams(b64Decode(sso));
  const nonce = decoded.get("nonce");
  const returnUrl = decoded.get("return_sso_url");
  if (!nonce || !returnUrl) return bad(400, "Malformed SSO payload");

  // verify caller is a logged-in app user (React supplies Authorization header)
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return bad(401, "Missing Authorization Bearer token");

  const supa = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { headers: { Authorization: authHeader } } });
  const { data: auth } = await supa.auth.getUser();
  if (!auth?.user) return bad(401, "Unauthorized");

  // load profile/registration info to fill name + groups (best effort)
  // Try profiles first; fall back to registrations (optional)
  const uid = auth.user.id;
  let username = auth.user.user_metadata?.username || auth.user.user_metadata?.preferred_username || "";
  let fullName = auth.user.user_metadata?.full_name || auth.user.user_metadata?.name || "";
  let email    = auth.user.email || "";

  if (!username || !fullName) {
    const { data: prof } = await supa.from("profiles").select("username, full_name, email, gender, xaccess").eq("id", uid).maybeSingle();
    if (prof) {
      username = username || prof.username || "";
      fullName = fullName || prof.full_name || "";
      email    = email || prof.email || "";
    }
    if (!username || !fullName || !email) {
      const { data: reg } = await supa.from("registrations")
        .select("username, firstName, lastName, email, gender")
        .eq("id", uid).maybeSingle();
      if (reg) {
        username = username || reg.username || "";
        fullName = fullName || [reg.firstName, reg.lastName].filter(Boolean).join(" ");
        email    = email || reg.email || "";
      }
    }
  }
  if (!username) username = auth.user.email?.split("@")[0] || `user_${uid.slice(0,8)}`;
  if (!fullName) fullName = username;

  // optional groups
  // If you have gender/xaccess on profiles, map to "men"/"women" plus XACCESS_GROUP
  let groups: string[] = [];
  try {
    const { data: prof } = await supa.from("profiles").select("gender, xaccess").eq("id", uid).maybeSingle();
    const g = (prof?.gender || "").toString().toLowerCase();
    if (["men","male","m"].includes(g)) groups.push("men");
    if (["women","woman","female","f"].includes(g)) groups.push("women");
    if (prof?.xaccess && XACCESS_GROUP) groups.push(XACCESS_GROUP);
  } catch {}

  // build outgoing SSO response
  const outgoing = new URLSearchParams({
    nonce,
    external_id: uid,
    email,
    username,
    name: fullName,
    add_groups: groups.join(","),
  }).toString();
  const b64 = btoa(outgoing);
  const outSig = await hmacHex(b64, DISCOURSE_SSO_SECRET);

  // final redirect to discourse
  const redirect = `${returnUrl}?sso=${encodeURIComponent(b64)}&sig=${outSig}`;
  return ok({ redirect });
});