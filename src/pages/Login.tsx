import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function Login() {
  const q = useQuery();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in, honor next redirect immediately
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const next = q.get("next");
        if (next === "/sso") {
          const sso = q.get("sso") || "";
          const sig = q.get("sig") || "";
          const qs = new URLSearchParams({ sso, sig }).toString();
          navigate(`/sso?${qs}`, { replace: true });
        } else {
          navigate("/", { replace: true });
        }
      }
    })();
  }, [navigate, q]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setError(error.message || "Login failed");
      return;
    }

    const next = q.get("next");
    if (next === "/sso") {
      const sso = q.get("sso") || "";
      const sig = q.get("sig") || "";
      const qs = new URLSearchParams({ sso, sig }).toString();
      window.location.replace(`/sso?${qs}`);
    } else {
      window.location.replace("/");
    }
  };

  return (
    <div style={{ maxWidth: 380, margin: "56px auto", padding: 24 }}>
      <h1>Sign in</h1>
      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{ width: "100%", padding: 8 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: 8 }}
          />
        </div>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: "8px 14px" }}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p style={{ marginTop: 16 }}>
        <Link to="/forgot">Forgot password?</Link>
      </p>
    </div>
  );
}