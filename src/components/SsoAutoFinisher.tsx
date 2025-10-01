import { useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { stashFromUrlOnce, hasPendingSso, finishDiscourseSso } from "@/lib/discourseSso";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

export default function SsoAutoFinisher() {
  useEffect(() => {
    // capture nonce/return on first render
    stashFromUrlOnce();

    // finish SSO whenever a sign-in completes
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