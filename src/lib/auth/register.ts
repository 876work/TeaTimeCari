// src/lib/auth/register.ts
import { supabase } from '@/lib/supabaseClient';
import { hasPendingSso, finishDiscourseSso } from "@/lib/discourseSso";
import { trackAuthLogin } from "@/hooks/useAuthActivityTracking";

export type SignupForm = {
  email: string;
  password: string;
  username?: string;
  full_name?: string;
  firstName?: string;
  lastName?: string;
  gender?: "Male" | "Female";
};

function buildFullName(form: SignupForm) {
  return (
    form.full_name?.trim() ||
    [form.firstName?.trim(), form.lastName?.trim()].filter(Boolean).join(" ")
  );
}

export async function registerAndSignIn(form: SignupForm) {
  const normalizedForm = {
    ...form,
    email: form.email.trim().toLowerCase(),
    username: form.username?.trim().toLowerCase(),
    fullName: buildFullName(form),
  };

  // 1) Create/confirm Auth user on the server and upsert registrations(pending).
  const { data: registration, error: registrationError } = await supabase.functions.invoke(
    "register-user",
    { body: normalizedForm },
  );

  if (registrationError) {
    throw registrationError;
  }

  if (!registration?.ok) {
    throw new Error(registration?.error || "Register failed");
  }

  // 2) Immediately sign in with the same credentials so pending users can see
  // the review-status screen and approved users can continue to the community.
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: normalizedForm.email,
    password: form.password,
  });
  if (signInErr) throw signInErr;

  await trackAuthLogin();

  // 3) Gate pending users.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No user after sign-in");

  const { data: reg, error: regError } = await supabase
    .from("registrations")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  if (regError) {
    throw regError;
  }

  if (!reg || reg.status !== "approved") {
    return { next: "/kyc-pending" as const };
  }

  // 4) Finish Discourse SSO if this journey started from Discourse.
  if (hasPendingSso()) {
    const { data: { session } } = await supabase.auth.getSession();
    await finishDiscourseSso(session?.access_token ?? "");
    return { next: null as const };
  }

  // 5) Normal navigation.
  return { next: "/community" as const };
}
