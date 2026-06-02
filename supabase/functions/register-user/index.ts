// supabase/functions/register-user/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { sendUnderReviewEmail } from "../_shared/resendEmail.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, key);

type RegistrationRequest = {
  email?: string;
  password?: string;
  password_temp?: string;
  username?: string;
  fullName?: string;
  full_name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  gender?: "Male" | "Female";
  captureType?: "selfie" | "id";
  imageData?: string;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

function usernameFromEmail(email: string) {
  const base = email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "_") || "user";
  return base.slice(0, 20) || "user";
}

function isAuthUserAlreadyRegisteredError(error: { message?: string } | null) {
  const message = error?.message?.toLowerCase() || "";
  return message.includes("already") || message.includes("registered") || message.includes("exists");
}

async function findAuthUserByEmail(email: string) {
  const perPage = 1000;
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return user;

    if (data.users.length < perPage) return null;
  }

  return null;
}

function normalizeRequest(body: RegistrationRequest) {
  const email = body.email?.trim().toLowerCase() || "";
  const password = body.password || body.password_temp || "";
  const username = body.username?.trim().toLowerCase() || usernameFromEmail(email);
  const fullName = (body.fullName || body.full_name || "").trim();
  const nameParts = splitName(fullName);
  const firstName = body.firstName?.trim() || nameParts.firstName;
  const lastName = body.lastName?.trim() || nameParts.lastName;

  return {
    email,
    password,
    username,
    fullName: fullName || [firstName, lastName].filter(Boolean).join(" "),
    firstName,
    lastName,
    phone: body.phone?.trim() || null,
    gender: body.gender,
    captureType: body.captureType,
    imageData: body.imageData,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const normalized = normalizeRequest(await req.json());

    if (!normalized.email || !normalized.password) {
      return json(400, { error: "email/password required" });
    }

    if (normalized.username.length < 3 || normalized.username.length > 20 || !/^[a-z0-9_]+$/.test(normalized.username)) {
      return json(400, { error: "username must be 3-20 letters, numbers, or underscores" });
    }

    // If this email already has a business registration, keep the flow idempotent
    // without changing the user's existing password.
    const { data: existingRegistration, error: registrationLookupError } = await admin
      .from("registrations")
      .select("id, status")
      .eq("email", normalized.email)
      .maybeSingle();

    if (registrationLookupError) {
      return json(500, {
        error: "registration lookup failed",
        detail: registrationLookupError.message,
      });
    }

    if (existingRegistration?.id) {
      return json(200, {
        ok: true,
        userId: existingRegistration.id,
        alreadyExists: true,
        status: existingRegistration.status,
      });
    }

    const { data: existingUsername, error: usernameLookupError } = await admin
      .from("registrations")
      .select("id")
      .eq("username", normalized.username)
      .maybeSingle();

    if (usernameLookupError) {
      return json(500, {
        error: "username lookup failed",
        detail: usernameLookupError.message,
      });
    }

    if (existingUsername?.id) {
      return json(409, { error: "username is already taken" });
    }

    // Create the Auth user first. Approval still happens through the registrations
    // table; email_confirm lets the applicant sign in and see /kyc-pending while
    // they wait for review. If a previous attempt already created the Auth user
    // but did not finish the business registration, recover that user and update
    // the password to the value the applicant just submitted.
    let isRecoveredAuthUser = false;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: normalized.email,
      password: normalized.password,
      email_confirm: true,
      user_metadata: {
        username: normalized.username,
        fullName: normalized.fullName,
        firstName: normalized.firstName,
        lastName: normalized.lastName,
        gender: normalized.gender,
      },
    });

    let userId = created.user?.id;

    if (createError || !userId) {
      if (!isAuthUserAlreadyRegisteredError(createError)) {
        return json(400, { error: createError?.message || "Unable to create auth user" });
      }

      const existingAuthUser = await findAuthUserByEmail(normalized.email);
      if (!existingAuthUser?.id) {
        return json(400, { error: "This email is already registered. Please sign in or reset your password." });
      }

      const { error: updateError } = await admin.auth.admin.updateUserById(existingAuthUser.id, {
        password: normalized.password,
        email_confirm: true,
        user_metadata: {
          ...(existingAuthUser.user_metadata || {}),
          username: normalized.username,
          fullName: normalized.fullName,
          firstName: normalized.firstName,
          lastName: normalized.lastName,
          gender: normalized.gender,
        },
      });

      if (updateError) {
        return json(400, { error: updateError.message || "Unable to update existing auth user" });
      }

      userId = existingAuthUser.id;
      isRecoveredAuthUser = true;
    }

    if (!userId) {
      return json(400, { error: "Unable to determine auth user" });
    }

    // Create the business/KYC registration. Do not persist the plaintext password.
    const { error: upsertError } = await admin
      .from("registrations")
      .upsert(
        {
          id: userId,
          email: normalized.email,
          username: normalized.username,
          firstName: normalized.firstName,
          lastName: normalized.lastName,
          phone: normalized.phone,
          gender: normalized.gender,
          captureType: normalized.captureType,
          imageData: normalized.imageData,
          status: "pending",
        },
        { onConflict: "id" },
      );

    if (upsertError) {
      if (!isRecoveredAuthUser) {
        await admin.auth.admin.deleteUser(userId).catch((deleteError) => {
          console.error("Failed to roll back auth user after registration upsert error", deleteError);
        });
      }

      return json(500, { error: "upsert failed", detail: upsertError.message });
    }

    const underReviewEmail = await sendUnderReviewEmail(
      normalized.email,
      normalized.firstName || normalized.username,
    ).catch((emailError) => ({ success: false, error: String(emailError) }));

    return json(200, {
      ok: true,
      userId,
      alreadyExists: false,
      recoveredAuthUser: isRecoveredAuthUser,
      status: "pending",
      emails: {
        underReview: underReviewEmail,
      },
    });
  } catch (e) {
    return json(500, { error: "internal", detail: String(e) });
  }
});
