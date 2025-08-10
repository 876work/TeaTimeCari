import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { generate6DigitCode, sha256Hex, expiresAt } from "../_shared/crypto.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const registrationId = body.registrationId ?? body.userId ?? null;
    const authUserId = body.authUserId ?? null;
    const email = body.email ?? null;

    if (!registrationId && !authUserId && !email) {
      throw new Error("Provide registrationId OR authUserId OR email");
    }

    let q = supabaseAdmin.from('registrations')
      .select('id, email, first_name, auth_user_id')
      .limit(1);

    if (registrationId) q = q.eq('id', registrationId);
    else if (authUserId) q = q.eq('auth_user_id', authUserId);
    else if (email) q = q.eq('email', email);

    const { data: rows, error: regErr } = await q;
    if (regErr) throw new Error(`DB read error: ${regErr.message}`);
    if (!rows || rows.length === 0) throw new Error("Registration not found");

    const reg = rows[0];

    const code = generate6DigitCode();
    const codeHash = await sha256Hex(code);
    const expiry = expiresAt(24);

    const { error: updErr } = await supabaseAdmin
      .from('registrations')
      .update({ kyc_code_hash: codeHash, kyc_expires_at: expiry, kyc_verified_at: null })
      .eq('id', reg.id);

    if (updErr) throw new Error(`DB write error: ${updErr.message}`);

    return new Response(JSON.stringify({ success: true, code, expiresAt: expiry }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error('[kyc-approve] fail:', err?.message || err);
    return new Response(
      JSON.stringify({ success: false, error: String(err?.message || err) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});