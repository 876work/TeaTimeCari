// src/lib/auth/register.ts
import { supabase } from '@/lib/supabaseClient';
import { hasPendingSso, finishDiscourseSso } from "@/lib/discourseSso";

// Change this to env if you prefer:
const REGISTER_FN = "https://vdfzpdjplyhaotzkbyja.functions.supabase.co/register-user";

export type SignupForm = {
  email: string;
  password: string;
  username?: string;
  full_name?: string;
  firstName?: string;
  lastName?: string;
  gender?: "Male" | "Female";
};

export async function registerAndSignIn(form: SignupForm) {
  // 1) Create/confirm Auth user on the server and upsert registrations(pending)
  const res = await fetch(REGISTER_FN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Register failed: ${t}`);
  }

  // 2) Immediately sign in with the same credentials
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: form.email,
    password: form.password,
  });
  if (signInErr) throw signInErr;

  // 3) Gate pending users (Option A)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No user after sign-in");

  const { data: reg } = await supabase
    .from("registrations")
    .select("status")
    .eq("id", user.id)
    .single();

  if (!reg || reg.status !== "approved") {
    return { next: "/kyc-pending" as const };
  }

  // 4) Finish Discourse SSO if this journey started from Discourse
  if (hasPendingSso()) {
    const { data: { session } } = await supabase.auth.getSession();
    await finishDiscourseSso(session?.access_token ?? "");
    return { next: null as const };
  }

  // 5) Normal navigation
  return { next: "/dashboard" as const };
}