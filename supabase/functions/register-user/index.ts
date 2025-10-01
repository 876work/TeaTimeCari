// supabase/functions/register-user/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, key);

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const { email, password, username, full_name, firstName, lastName, gender } =
      await req.json();

    if (!email || !password) return json(400, { error: "email/password required" });

    // 1) Find or create Auth user (confirmed so they can sign in immediately)
    const { data: existing } = await admin.auth.admin.getUserByEmail(email);
    let userId = existing?.user?.id;

    if (!userId) {
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password,              // never log this
        email_confirm: true,   // allows immediate sign-in
        user_metadata: { username, full_name, firstName, lastName, gender },
      });
      if (cErr) return json(400, { error: cErr.message });
      userId = created.user.id;
    }

    // 2) Upsert business record as pending
    const { error: uErr } = await admin
      .from("registrations")
      .upsert(
        {
          id: userId,
          email,
          username,
          fullName: full_name,
          firstName,
          lastName,
          gender,
          status: "pending",
        },
        { onConflict: "id" },
      );
    if (uErr) return json(500, { error: "upsert failed", detail: uErr.message });

    return json(200, { ok: true, userId });
  } catch (e) {
    return json(500, { error: "internal", detail: String(e) });
  }
});