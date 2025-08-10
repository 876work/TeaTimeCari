import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { generate6DigitCode, randomToken, sha256Hex, expiresAt } from "../_shared/crypto.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { userId } = await req.json();
    if (!userId) throw new Error("Missing userId");

    // Lookup registration
    const { data: reg, error: regErr } = await supabaseAdmin
      .from('registrations')
      .select('id, email, firstName')
      .eq('id', userId)
      .single();
    if (regErr || !reg) throw new Error("Registration not found");

    // Create code + token, store hashes + expiry
    const code = generate6DigitCode();
    const token = randomToken(32);
    const [codeHash, tokenHash] = await Promise.all([sha256Hex(code), sha256Hex(token)]);
    const expiry = expiresAt(24); // 24 hours

    const { error: updErr } = await supabaseAdmin
      .from('registrations')
      .update({ 
        kyc_code_hash: codeHash, 
        kyc_token_hash: tokenHash, 
        kyc_expires_at: expiry, 
        kyc_verified_at: null,
        status: 'approved'
      })
      .eq('id', reg.id);
    if (updErr) throw new Error("Failed to persist KYC data");

    // Return plaintext code and token for admin to manually send
    const siteUrl = (Deno.env.get("KYC_SITE_URL") ?? Deno.env.get("SITE_URL") ?? "").replace(/\/+$/,'');
    const verifyLink = siteUrl ? `${siteUrl}/kyc-verification?token=${token}` : `[SITE_URL]/kyc-verification?token=${token}`;

    return new Response(JSON.stringify({ 
      success: true,
      code: code,
      token: token,
      verifyLink: verifyLink,
      expiresAt: expiry,
      userEmail: reg.email,
      userName: reg.firstName
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: String(err?.message ?? err) 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});