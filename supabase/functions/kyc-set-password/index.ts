import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { verifyHS256 } from "../_shared/jwt.ts";

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