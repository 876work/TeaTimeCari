import React, { useEffect, useMemo, useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { LogIn, Loader2, AlertCircle, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { supabase } from "@/lib/supabaseClient";
import { hasPendingSso, finishDiscourseSso } from "@/lib/discourseSso";

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
  const [showPassword, setShowPassword] = useState(false);

  const getPostLoginDestination = () => {
    const next = q.get("next");
    const redirectTo = q.get("redirectTo");
    const returnTo = q.get("returnTo");

    if (next === "/sso") {
      const sso = q.get("sso");
      const sig = q.get("sig");
      if (sso && sig) {
        return `/sso?sso=${encodeURIComponent(sso)}&sig=${encodeURIComponent(sig)}`;
      }
    }

    return next || redirectTo || returnTo || "/community";
  };

  const getApprovalStatus = async (
    userId: string
  ): Promise<"approved" | "not_approved" | "missing"> => {
    const { data, error: statusError } = await supabase
      .from("registrations")
      .select("status")
      .eq("id", userId)
      .maybeSingle();

    if (statusError) throw statusError;
    if (!data?.status) return "missing";
    return data.status === "approved" ? "approved" : "not_approved";
  };

  const redirectAfterApprovalCheck = async (userId: string) => {
    const approvalStatus = await getApprovalStatus(userId);

    if (approvalStatus !== "approved") {
      window.location.href = "/kyc-pending";
      return;
    }

    if (hasPendingSso()) {
      const { data: { session } } = await supabase.auth.getSession();
      await finishDiscourseSso(session?.access_token ?? "");
      return;
    }

    window.location.href = getPostLoginDestination();
  };

  useEffect(() => {
    let isMounted = true;

    const checkExistingSession = async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      if (!userId || !isMounted) return;

      try {
        const approvalStatus = await getApprovalStatus(userId);
        if (!isMounted) return;
        if (approvalStatus === "approved") {
          navigate(getPostLoginDestination(), { replace: true });
          return;
        }
        navigate("/kyc-pending", { replace: true });
      } catch (err: any) {
        if (!isMounted) return;
        setError(
          `Unable to verify approval status. Please try again. ${err?.message ? `(${err.message})` : ""}`.trim()
        );
      }
    };

    checkExistingSession();
    return () => { isMounted = false; };
  }, [navigate, q]);

  const signInWithFallback = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    const firstAttempt = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (!firstAttempt.error) return firstAttempt;

    const { data: bootstrapResult, error: bootstrapError } = await supabase.functions.invoke(
      "bootstrap-login",
      { body: { email: normalizedEmail, password } },
    );

    if (bootstrapError || !bootstrapResult?.ok) return firstAttempt;

    return supabase.auth.signInWithPassword({ email: normalizedEmail, password });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: signInData, error } = await signInWithFallback();

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    try {
      const userId = signInData.user?.id;
      if (!userId) throw new Error("No authenticated user found after login.");
      await redirectAfterApprovalCheck(userId);
    } catch (err: any) {
      setError(
        `Unable to verify approval status. Please try again. ${err?.message ? `(${err.message})` : ""}`.trim()
      );
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="dark-form-box w-full max-w-md mx-auto px-10 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, #A3C6E0, #E0A3A3)" }}>
            <LogIn className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Welcome Back</h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
            Sign in to your Tea Time Cari account
          </p>
        </div>

        {error && (
          <div className="dark-alert-error">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={onSubmit}>
          {/* Email */}
          <div className={`form-field ${email ? "has-value" : ""}`}>
            <input
              type="email"
              id="login-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="email"
            />
            <label htmlFor="login-email">Email Address</label>
          </div>

          {/* Password */}
          <div className={`form-field ${password ? "has-value" : ""}`}>
            <div className="input-with-toggle">
              <input
                type={showPassword ? "text" : "password"}
                id="login-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="current-password"
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
            <label htmlFor="login-password">Password</label>
          </div>

          <div className="text-center mt-8">
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="dark-btn"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2 normal-case tracking-normal">
                  <Loader2 className="animate-spin w-4 h-4" /> Signing in...
                </span>
              ) : (
                <>
                  Sign In
                  <span />
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-8 space-y-3 text-center">
          <Link
            to="/forgot-password"
            className="block text-sm transition-colors"
            style={{ color: "#A3C6E0" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#E0A3A3")}
            onMouseLeave={e => (e.currentTarget.style.color = "#A3C6E0")}
          >
            Forgot your password?
          </Link>

          <Link
            to="/"
            className="flex items-center justify-center gap-2 text-sm transition-colors"
            style={{ color: "rgba(255,255,255,0.4)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>

        <div className="mt-8 dark-alert-info text-center">
          <strong>New to Tea Time Cari?</strong> You'll need an invitation to join our community.
        </div>
      </div>
    </AuthLayout>
  );
}
