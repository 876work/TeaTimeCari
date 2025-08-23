import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { verifyHS256 } from "../_shared/jwt.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { act } = await req.json();
    if (!act) throw new Error("Missing act token");

    const secret = Deno.env.get("KYC_JWT_SECRET");
    if (!secret) throw new Error("Missing KYC_JWT_SECRET");
    
    const payload = await verifyHS256(act, secret);
    if (payload.type !== 'kyc_set_password') throw new Error("Wrong token type");

    const userId = payload.user_id;

    // Fetch user registration data
    const { data: registration, error } = await supabaseAdmin
      .from('registrations')
      .select('fullName, email, phone, username, gender, captureType, created_at')
      .eq('id', userId)
      .single();

    if (error || !registration) throw new Error("Registration not found");

    return new Response(JSON.stringify({ 
      success: true, 
      data: {
        fullName: registration.fullName,
        email: registration.email,
        phone: registration.phone,
        username: registration.username,
        gender: registration.gender,
        captureType: registration.captureType,
        submittedAt: registration.created_at
      }
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: String(err?.message ?? err) 
    }), { 
      status: 400, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});