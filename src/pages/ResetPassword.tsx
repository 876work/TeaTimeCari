import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Loader2, AlertCircle, CheckCircle, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { supabase } from '@/lib/supabaseClient';

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<null | { ok: boolean; msg: string }>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setStatus({ ok: false, msg: "Reset link invalid or expired. Please request a new one." });
      }
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setStatus({ ok: false, msg: "Passwords do not match." });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) setStatus({ ok: false, msg: error.message });
    else setStatus({ ok: true, msg: "Password updated. You can now sign in." });
  }

  return (
    <AuthLayout>
      <div className="dark-form-box w-full max-w-md mx-auto px-10 py-12">
        <div className="text-center mb-10">
          <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, #A3C6E0, #E0A3A3)" }}>
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Set a New Password</h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
            Choose a strong password of at least 10 characters.
          </p>
        </div>

        {status && !status.ok && (
          <div className="dark-alert-error">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{status.msg}</span>
          </div>
        )}

        {status && status.ok ? (
          <div className="text-center">
            <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4"
              style={{ background: "rgba(110,231,183,0.15)" }}>
              <CheckCircle className="w-7 h-7" style={{ color: "#6ee7b7" }} />
            </div>
            <p className="mb-6" style={{ color: "#6ee7b7", fontSize: 14 }}>{status.msg}</p>
            <Link to="/login" className="dark-btn block" style={{ display: "block" }}>
              Go to Login
              <span />
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <div className={`form-field ${password ? "has-value" : ""}`}>
              <div className="input-with-toggle">
                <input
                  type={showPassword ? "text" : "password"}
                  id="rp-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="new-password"
                  minLength={10}
                />
                <button
                  type="button"
                  className="toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <label htmlFor="rp-password">New Password</label>
            </div>

            <div className={`form-field ${confirm ? "has-value" : ""}`}>
              <div className="input-with-toggle">
                <input
                  type={showConfirm ? "text" : "password"}
                  id="rp-confirm"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="new-password"
                  minLength={10}
                />
                <button
                  type="button"
                  className="toggle-btn"
                  onClick={() => setShowConfirm(!showConfirm)}
                  tabIndex={-1}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <label htmlFor="rp-confirm">Confirm New Password</label>
            </div>

            {confirm && password && password === confirm && (
              <p className="field-success -mt-4 mb-4">Passwords match</p>
            )}

            <div className="text-center mt-4">
              <button
                type="submit"
                disabled={loading || !password || !confirm}
                className="dark-btn"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2 normal-case tracking-normal">
                    <Loader2 className="animate-spin w-4 h-4" /> Updating...
                  </span>
                ) : (
                  <>
                    Update Password
                    <span />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {!status?.ok && (
          <div className="mt-8 text-center">
            <Link
              to="/forgot-password"
              className="flex items-center justify-center gap-2 text-sm transition-colors"
              style={{ color: "rgba(255,255,255,0.4)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
            >
              <ArrowLeft className="w-4 h-4" />
              Request a new reset link
            </Link>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
