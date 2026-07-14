import type { SupabaseClient } from '@supabase/supabase-js';

export const APP_LOGOUT_REDIRECT_PATH = '/';

export function clearLogoutStorage() {
  try {
    localStorage.removeItem('supabase.auth.token');
    sessionStorage.clear();
  } catch (storageError) {
    console.warn('Failed to clear storage:', storageError);
  }
}

export async function signOutOfApp(supabaseClient: Pick<SupabaseClient, 'auth'>) {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    throw error;
  }

  clearLogoutStorage();
}
