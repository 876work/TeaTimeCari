// src/features/admin/registrations/api/approveRegistration.ts
import { supabase } from '@/lib/supabaseClient';
import { getFunctionErrorMessage } from '@/lib/functionError';

export type ApprovalAction = 'approve' | 'retry_discourse_sync';

export async function approveRegistration(registrationId: string, action: ApprovalAction = 'approve') {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not logged in');

  const { data, error } = await supabase.functions.invoke('approve-and-sync', {
    body: { registration_id: registrationId, action },
    headers: { Authorization: `Bearer ${session.access_token}` }
  });

  if (error) {
    console.error('approve-and-sync function error:', error);
    throw new Error(await getFunctionErrorMessage(error));
  }

  return data;
}

export function retryDiscourseSync(registrationId: string) {
  return approveRegistration(registrationId, 'retry_discourse_sync');
}
