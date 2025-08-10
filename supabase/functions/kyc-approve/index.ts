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
    const expiry = expiresAt(24);

    const { error: updErr } = await supabaseAdmin
      .from('registrations')
      .update({ kyc_code_hash: codeHash, kyc_token_hash: tokenHash, kyc_expires_at: expiry, kyc_verified_at: null })
      .eq('id', reg.id);
    if (updErr) throw new Error("Failed to persist KYC data");

    // Compose email
    const apiKey = Deno.env.get("SENDGRID_API_KEY");
    const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL");
    const siteUrl = (Deno.env.get("KYC_SITE_URL") ?? Deno.env.get("SITE_URL") ?? "").replace(/\/+$/,'');
    if (!apiKey) throw new Error("Missing SENDGRID_API_KEY");
    if (!fromEmail) throw new Error("Missing SENDGRID_FROM_EMAIL");
    if (!siteUrl) throw new Error("Missing KYC_SITE_URL");

    const verifyLink = `${siteUrl}/kyc-verification?token=${token}`;
    const subject = "Your account is approved – verify with your 6-digit code";
    const text = `Hi ${reg.firstName ?? 'there'},

Your application has been approved.

Your 6-digit code: ${code}
Verification link: ${verifyLink}

This code/link will expire in 24 hours.

— The Team`;

    const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: reg.email }] }],
        from: { email: fromEmail },
        subject,
        content: [{ type: "text/plain", value: text }],
      }),
    });
    if (!resp.ok) throw new Error(`SendGrid ${resp.status}: ${await resp.text()}`);

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" }});
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err?.message ?? err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
  }
});