import { useEffect } from "react";

// In your hosting env, set VITE_DISCOURSE_BASE_URL=https://community.teatimecari.app
const DISCOURSE_BASE =
  import.meta.env.VITE_DISCOURSE_BASE_URL || "https://community.teatimecari.app";

export default function Community() {
  useEffect(() => {
    // Send users to Discourse login, which triggers SSO back to /sso
    window.location.replace(`${DISCOURSE_BASE}/login`);
  }, []);

  return null;
}