import { useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

const DISCOURSE_BASE =
  import.meta.env.VITE_DISCOURSE_BASE_URL || "https://community.teatimecari.app";

export default function Logout() {
  useEffect(() => {
    (async () => {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      } finally {
        // Try to log out of Discourse too; some versions need a confirm click.
        // If logout requires POST+CSRF, this redirect at least lands them on the logout page.
        window.location.replace(`${DISCOURSE_BASE}/logout`);
      }
    })();
  }, []);

  return null;
}