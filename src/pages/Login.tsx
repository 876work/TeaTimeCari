import React, { useEffect, useMemo, useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import {
  LogIn,
  Mail,
  Lock,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
} from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { supabase } from "@/lib/supabaseClient";
import { hasPendingSso, finishDiscourseSso } from "@/lib/discourseSso";
import { trackAuthLogin } from "@/hooks/useAuthActivityTracking";

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

    if (statusError) {
      throw statusError;
    }

    if (!data?.status) {
      return "missing";
    }

    return data.status === "approved" ? "approved" : "not_approved";
  };

  const redirectAfterApprovalCheck = async (userId: string) => {
    const approvalStatus = await getApprovalStatus(userId);

    if (approvalStatus !== "approved") {
      window.location.href = "/kyc-pending";
      return;
    }

    if (hasPendingSso()) {
      const {
        data: { session },
      } = await supabase.auth.getSession();

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

      if (!userId || !isMounted) {
        return;
      }

      try {
        const approvalStatus = await getApprovalStatus(userId);

        if (!isMounted) {
          return;
        }

        if (approvalStatus === "approved") {
          navigate(getPostLoginDestination(), { replace: true });
          return;
        }

        navigate("/kyc-pending", { replace: true });
      } catch (err: any) {
        if (!isMounted) {
          return;
        }

        setError(
          `Unable to verify approval status. Please try again. ${
            err?.message ? `(${err.message})` : ""
          }`.trim()
        );
      }
    };

    checkExistingSession();

    return () => {
      isMounted = false;
    };
  }, [navigate, q]);

  const signInWithFallback = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    const firstAttempt = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (!firstAttempt.error) {
      return firstAttempt;
    }

    const { data: bootstrapResult, error: bootstrapError } = await supabase.functions.invoke(
      "bootstrap-login",
      { body: { email: normalizedEmail, password } },
    );

    if (bootstrapError || !bootstrapResult?.ok) {
      return firstAttempt;
    }

    return supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
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

      if (!userId) {
        throw new Error("No authenticated user found after login.");
      }

      await trackAuthLogin();
      await redirectAfterApprovalCheck(userId);
    } catch (err: any) {
      setError(
        `Unable to verify approval status. Please try again. ${
          err?.message ? `(${err.message})` : ""
        }`.trim()
      );

      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <LogIn className="w-8 h-8 text-[#A3C6E0]" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome Back
          </h1>

          <p className="text-gray-600">
            Sign in to your Tea Time Cari account
          </p>
        </div>

        {error && (
          <div
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"
            role="alert"
          >
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Email Address
            </label>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>

              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300 bg-white hover:border-[#A3C6E0]"
                placeholder="Enter your email address"
                required
                disabled={loading}
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Password
            </label>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>

              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300 bg-white hover:border-[#A3C6E0]"
                placeholder="Enter your password"
                required
                disabled={loading}
                autoComplete="current-password"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
              !loading && email && password
                ? "bg-gradient-to-r from-[#A3C6E0] to-[#E0A3A3] hover:from-[#8BB5D9] hover:to-[#D98B8B] text-white shadow-md hover:shadow-lg transform hover:scale-[1.02]"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                Signing in...
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <LogIn className="w-5 h-5 mr-2" />
                Sign In
              </div>
            )}
          </button>
        </form>

        <div className="mt-8 space-y-4">
          <div className="text-center">
            <Link
              to="/forgot-password"
              className="text-sm text-[#A3C6E0] hover:text-[#8BB5D9] transition-colors font-medium"
            >
              Forgot your password?
            </Link>
          </div>

          <div className="text-center">
            <Link
              to="/"
              className="flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
          </div>
        </div>

        <div className="mt-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 text-center">
              <strong>New to Tea Time Cari?</strong> You'll need an invitation
              to join our community.
            </p>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}