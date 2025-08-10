import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

async function verifyHS256(jwt: string, secret: string): Promise<any> {
  const [h, p, s] = jwt.split('.');
  if (!h || !p || !s) throw new Error("Malformed token");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  const ok = await crypto.subtle.verify('HMAC', key, Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0)), enc.encode(`${h}.${p}`));
  if (!ok) throw new Error("Invalid signature");
  const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(p.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0))));
  if (payload.exp && payload.exp*1000 < Date.now()) throw new Error("Token expired");
  return payload;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { act, password } = await req.json();
    if (!act || !password) throw new Error("Missing act or password");

    const secret = Deno.env.get("KYC_JWT_SECRET");
    if (!secret) throw new Error("Missing KYC_JWT_SECRET");
    const payload = await verifyHS256(act, secret);
    if (payload.type !== 'kyc_set_password') throw new Error("Wrong token type");

    const userId = payload.user_id;
    const email = payload.email;

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
    if (updErr) throw new Error(updErr.message ?? "Failed to set password");

    return new Response(JSON.stringify({ success: true, email }), { headers: { ...corsHeaders, "Content-Type": "application/json" }});
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err?.message ?? err) }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }});
  }
});