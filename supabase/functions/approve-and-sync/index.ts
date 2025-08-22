// supabase/functions/approve-and-sync/index.ts
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, apikey, x-admin-secret, content-type, x-client-info, x-supabase-api-version",
  "Vary": "Origin, Access-Control-Request-Headers",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  return new Response(JSON.stringify({ ok: true, message: "stub alive" }), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
