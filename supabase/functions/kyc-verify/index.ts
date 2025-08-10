import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { sha256Hex } from "../_shared/crypto.ts";
import { signHS256 } from "../_shared/jwt.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { token, code } = await req.json();
    if (!token || !code) throw new Error("Missing token or code");

    const [tHash, cHash] = await Promise.all([sha256Hex(token), sha256Hex(code)]);
    const { data: reg, error } = await supabaseAdmin
      .from('registrations')
      .select('id, email, firstName, kyc_code_hash, kyc_token_hash, kyc_expires_at, kyc_verified_at')
      .eq('kyc_token_hash', tHash)
      .single();
    if (error || !reg) throw new Error("Invalid or expired token");
    if (!reg.kyc_code_hash || reg.kyc_code_hash !== cHash) throw new Error("Invalid code");
    if (reg.kyc_expires_at && new Date(reg.kyc_expires_at).getTime() < Date.now()) throw new Error("Code expired");

    // Mark verified timestamp (optional but nice)
    await supabaseAdmin.from('registrations').update({ kyc_verified_at: new Date().toISOString() }).eq('id', reg.id);

    const secret = Deno.env.get("KYC_JWT_SECRET");
    if (!secret) throw new Error("Missing KYC_JWT_SECRET");

    // action token contains userId + email; TTL 10 minutes
    const act = await signHS256(
      { type: "kyc_set_password", user_id: reg.id, email: reg.email },
      secret,
      600
    );

    return new Response(JSON.stringify({ success: true, act }), { headers: { ...corsHeaders, "Content-Type": "application/json" }});
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err?.message ?? err) }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }});
  }
});