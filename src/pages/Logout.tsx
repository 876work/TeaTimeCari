import { useEffect } from "react";
import { supabase } from '@/lib/supabaseClient';
import { APP_LOGOUT_REDIRECT_PATH, signOutOfApp } from '@/lib/logout';

export default function Logout() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await signOutOfApp(supabase);
      } catch (error) {
        console.error('Logout failed:', error);
      } finally {
        if (!cancelled) {
          window.location.replace(APP_LOGOUT_REDIRECT_PATH);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
