// supabase/functions/bootstrap-login/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, key);

type BootstrapLoginRequest = {
  email?: string;
  identifier?: string;
  password?: string;
};

type Registration = {
  id: string;
  email: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  gender?: string | null;
  password_temp?: string | null;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getAnonKey(req: Request) {
  const envAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (envAnonKey) return envAnonKey;

  const authorization = req.headers.get("Authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
}

function createPublicClient(req: Request) {
  const anonKey = getAnonKey(req);

  if (!anonKey) {
    throw new Error("Missing Supabase anon key for password sign-in");
  }

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function normalizeIdentifier(identifier: string) {
  const normalized = identifier.trim().toLowerCase();

  return {
    value: normalized,
    isEmail: normalized.includes("@"),
  };
}

function authResponse(session: unknown, user: { id: string; email?: string | null }) {
  return {
    ok: true,
    session,
    user: {
      id: user.id,
      email: user.email ?? null,
    },
  };
}

function metadataFromRegistration(registration: Registration) {
  return {
    username: registration.username ?? undefined,
    fullName:
      [registration.firstName, registration.lastName].filter(Boolean).join(" ") || undefined,
    firstName: registration.firstName ?? undefined,
    lastName: registration.lastName ?? undefined,
    gender: registration.gender ?? undefined,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const body = (await req.json()) as BootstrapLoginRequest;
    const identifier = body.identifier || body.email || "";
    const login = normalizeIdentifier(identifier);
    const password = body.password || "";

    if (!login.value || !password) {
      return json(400, { error: "email, username, and password required" });
    }

    const registrationQuery = admin
      .from("registrations")
      .select("id, email, username, firstName, lastName, gender, password_temp")
      .limit(1);

    const { data: registrationRows, error: registrationError } = login.isEmail
      ? await registrationQuery.eq("email", login.value)
      : await registrationQuery.eq("username", login.value);
    const registration = (registrationRows?.[0] ?? null) as Registration | null;

    if (registrationError) {
      console.error("bootstrap-login registration lookup failed", registrationError);
      return json(500, { error: "registration lookup failed" });
    }

    if (!registration?.id || !registration.email) {
      return json(401, { error: "Invalid login credentials" });
    }

    const email = registration.email.trim().toLowerCase();
    const publicClient = createPublicClient(req);
    const firstAttempt = await publicClient.auth.signInWithPassword({
      email,
      password,
    });

    if (!firstAttempt.error && firstAttempt.data.session && firstAttempt.data.user) {
      return json(200, authResponse(firstAttempt.data.session, firstAttempt.data.user));
    }

    if (registration.password_temp !== password) {
      return json(401, { error: "Invalid login credentials" });
    }

    const userMetadata = metadataFromRegistration(registration);
    const { data: existingUser } = await admin.auth.admin.getUserById(registration.id);

    if (existingUser?.user) {
      const { error: updateError } = await admin.auth.admin.updateUserById(
        registration.id,
        {
          email,
          password,
          email_confirm: true,
          user_metadata: userMetadata,
        },
      );

      if (updateError) {
        console.error("bootstrap-login auth update failed", updateError);
        return json(500, { error: "Unable to prepare your account for login" });
      }
    } else {
      const { error: createError } = await admin.auth.admin.createUser({
        id: registration.id,
        email,
        password,
        email_confirm: true,
        user_metadata: userMetadata,
      });

      if (createError) {
        console.error("bootstrap-login auth create failed", createError);
        return json(500, { error: "Unable to prepare your account for login" });
      }
    }

    const { error: clearPasswordError } = await admin
      .from("registrations")
      .update({ password_temp: null })
      .eq("id", registration.id);

    if (clearPasswordError) {
      console.warn("bootstrap-login failed to clear password_temp", clearPasswordError);
    }

    const secondAttempt = await publicClient.auth.signInWithPassword({
      email,
      password,
    });

    if (secondAttempt.error || !secondAttempt.data.session || !secondAttempt.data.user) {
      console.error("bootstrap-login sign-in failed after auth preparation", secondAttempt.error);
      return json(500, { error: "Unable to complete login" });
    }

    return json(200, authResponse(secondAttempt.data.session, secondAttempt.data.user));
  } catch (error) {
    console.error("bootstrap-login internal error", error);
    return json(500, { error: "internal", detail: String(error) });
  }
});
