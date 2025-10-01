import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { stashFromUrlOnce, hasPendingSso, finishDiscourseSso } from "@/lib/discourseSso";

export default function SsoAutoFinisher() {
  useEffect(() => {
    // Capture sso_nonce & r on app load (idempotent)
    stashFromUrlOnce();

    // When any sign-in completes, finish SSO if a nonce is pending
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && hasPendingSso() && session?.access_token) {
        await finishDiscourseSso(session.access_token);
      }
    });

    return () => {
      sub.subscription?.unsubscribe?.();
    };
  }, []);

  return null;
}