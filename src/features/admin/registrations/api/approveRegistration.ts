// src/features/admin/registrations/api/approveRegistration.ts
import { supabase } from '@/lib/supabaseClient';

async function getFunctionErrorMessage(error: unknown) {
  const fallback = error instanceof Error ? error.message : 'Approval failed.';
  const maybeContext = (error as { context?: unknown })?.context;
  const response = maybeContext instanceof Response
    ? maybeContext
    : (maybeContext as { response?: Response } | undefined)?.response;

  if (response) {
    try {
      const body = await response.clone().json();
      if (body?.error) return body.error as string;
      if (body?.message) return body.message as string;
    } catch {
      try {
        const text = await response.clone().text();
        if (text) return text;
      } catch {
        // Fall through to the Supabase client error message.
      }
    }
  }

  return fallback;
}

export async function approveRegistration(registrationId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not logged in");

  const { data, error } = await supabase.functions.invoke("approve-and-sync", {
    body: { registration_id: registrationId },
    headers: { Authorization: `Bearer ${session.access_token}` }
  });

  if (error) {
    console.error("approve-and-sync function error:", error);
    throw new Error(await getFunctionErrorMessage(error));
  }

  return data;
}
