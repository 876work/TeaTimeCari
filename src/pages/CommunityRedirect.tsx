import { useEffect } from "react";

export default function CommunityRedirect() {
  useEffect(() => {
    window.location.replace("https://community.teatimecari.app/session/sso?return_path=/");
  }, []);

  return null;
}