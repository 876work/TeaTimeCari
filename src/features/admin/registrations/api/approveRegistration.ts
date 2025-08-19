import { supabase } from "../../../../lib/supabaseClient";

export async function approveRegistration(registrationId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not logged in');

  const { data, error } = await supabase.functions.invoke('approve-and-sync', {
    body: { registration_id: registrationId },
    headers: { Authorization: `Bearer ${session.access_token}` }
  });

  if (error) throw error;
  return data;
}