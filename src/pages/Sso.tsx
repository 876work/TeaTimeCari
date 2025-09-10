import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase"; // your existing client

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function Sso() {
  const q = useQuery();
  const navigate = useNavigate();
  const [msg, setMsg] = useState("Preparing SSO…");

  useEffect(() => {
    (async () => {
      const sso = q.get("sso") || "";
      const sig = q.get("sig") || "";

      if (!sso || !sig) {
        setMsg("Missing SSO parameters.");
        return;
      }

      // Are we logged in?
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        // send to login and preserve where to return
        const params = new URLSearchParams({
          next: "/sso",
          sso,
          sig,
        }).toString();
        navigate(`/login?${params}`, { replace: true });
        return;
      }

      setMsg("Finishing SSO…");

      // Call the Edge Function. The Supabase client will attach the
      // user's Authorization Bearer automatically.
      const { data, error } = await supabase.functions.invoke("sso-complete", {
        body: { sso, sig },
      });

      if (error) {
        console.error("sso-complete error:", error);
        setMsg("Could not complete SSO. Please try again.");
        return;
      }

      if (data?.redirect) {
        window.location.href = data.redirect as string;
      } else {
        setMsg("Unexpected response from SSO.");
      }
    })();
  }, [navigate, q]);

  return (
    <div style={{ padding: 24 }}>
      <h1>Connecting…</h1>
      <p>{msg}</p>
    </div>
  );
}