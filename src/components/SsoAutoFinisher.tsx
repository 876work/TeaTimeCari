import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { stashFromUrlOnce, hasPendingSso, finishDiscourseSso } from "@/lib/discourseSso";

export default function SsoAutoFinisher() {
  useEffect(() => {
    (async () => {
      // Capture sso_nonce & r as early as possible
      stashFromUrlOnce();

      // If already signed in on mount, finish immediately
      const { data: { session } } = await supabase.auth.getSession();
      if (hasPendingSso() && session?.access_token) {
        await finishDiscourseSso(session.access_token);
        return; // prevent double-handling below
      }

      // Also handle fresh sign-ins
      const { data: sub } = supabase.auth.onAuthStateChange(async (event, sess) => {
        if (event === "SIGNED_IN" && hasPendingSso() && sess?.access_token) {
          await finishDiscourseSso(sess.access_token);
        }
      });

      return () => sub.subscription?.unsubscribe?.();
    })();
  }, []);

  return null;
}

