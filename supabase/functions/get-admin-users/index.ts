import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

async function isAdmin(userId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();

  if (error && error.code !== "42703" && error.code !== "42P01") throw error;
  return Boolean(data?.is_admin);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const token = getBearerToken(req);
    if (!token) return json(401, { error: "Unauthorized" });

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json(401, { error: "Unauthorized" });
    if (!(await isAdmin(authData.user.id))) return json(403, { error: "Forbidden: admin only" });

    const { data, error } = await admin
      .from("registrations")
      .select(`
        id,
        firstName,
        lastName,
        email,
        phone,
        username,
        gender,
        captureType,
        imageData,
        status,
        created_at,
        rejection_reason,
        registration_ip_address,
        registration_ip_location,
        registration_browser,
        registration_device,
        registration_operating_system,
        registration_user_agent,
        last_login_at,
        last_login_ip_address,
        last_login_ip_location,
        last_login_browser,
        last_login_device,
        last_login_operating_system,
        last_login_user_agent,
        last_seen_at
      `)
      .order("created_at", { ascending: false });

    if (error) return json(500, { error: "users lookup failed", detail: error.message });

    return json(200, { ok: true, users: data ?? [] });
  } catch (error) {
    return json(500, { error: "internal", detail: String(error) });
  }
});
