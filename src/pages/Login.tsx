import React, { useEffect, useMemo, useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import {
  LogIn,
  User,
  Lock,
  ArrowLeft,
  Eye,
  EyeOff,
} from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { FormField, PageSection, PrimaryButton, PrivacyNote, StatusAlert } from "../components/Form";
import { supabase } from "@/lib/supabaseClient";
import { hasPendingSso, finishDiscourseSso } from "@/lib/discourseSso";
import { trackAuthLogin } from "@/hooks/useAuthActivityTracking";
import { ApprovalStatus, getApprovalStatus, isBlockedStatus, safeAppPath } from "@/lib/auth/approvalStatus";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const getApprovalMessage = (status: ApprovalStatus) => {
  switch (status) {
    case "pending":
      return "Your application is still under review. We’ll email you when the review is complete, or you can check your status from the pending page.";
    case "rejected":
      return "This account was not approved for community access. Please contact support if you believe this decision was made in error.";
    case "suspended":
      return "This account is currently suspended, so access is paused. You have been signed out for safety. Contact support if you believe this is a mistake.";
    case "banned":
      return "This account is not eligible to access Tea Time Cari. You have been signed out for safety. Contact support if you believe this is a mistake.";
    case "missing":
      return "We could not find a completed application for this account. Sign in with the email you used to register, contact support, or start a new signup if you have not applied yet.";
    case "not_approved":
      return "This account is not approved for community access yet. Please check your application status or contact support if this looks incorrect.";
    default:
      return "Your account is not currently eligible to log in or use Tea Time Cari. Please contact support if you believe this is a mistake.";
  }
};

const getKycPendingUrl = (status: ApprovalStatus) => `/kyc-pending?status=${encodeURIComponent(status)}`;

const getSsoSessionExpiredMessage = () =>
  "Your community sign-in session expired or is missing required security details. Please start again from the Community link, then log in if prompted.";

const roleDestinations: Record<string, string> = {
  business: "/business/dashboard",
  creator: "/creator/dashboard",
  admin: "/admin",
};

type LoginProfile = {
  role?: string | null;
  status?: string | null;
  is_admin?: boolean | null;
  xaccess?: boolean | null;
  kyc_status?: string | null;
};

const getRoleDestination = async (userId: string, fallback: string) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("role, status, is_admin, xaccess, kyc_status")
    .eq("id", userId)
    .maybeSingle<LoginProfile>();

  if (error || !data) {
    return "/account/setup-error";
  }

  if (data.status === "suspended") return "/account/suspended";
  if (data.status === "deleted") return "/account/unavailable";

  const role = data.role || (data.is_admin ? "admin" : null);
  if (role && roleDestinations[role]) return roleDestinations[role];

  const hasLegacyAccess = data.status === "active" || data.kyc_status === "approved" || data.xaccess === true;
  return hasLegacyAccess ? fallback : "/account/setup-error";
};


export default function Login() {
  const q = useQuery();
  const navigate = useNavigate();

  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const getPostLoginDestination = React.useCallback(() => {
    const next = q.get("next");

    if (next === "/sso") {
      return "/community";
    }

    return safeAppPath(next || q.get("redirectTo") || q.get("returnTo"));
  }, [q]);

  const redirectAfterApprovalCheck = async (userId: string) => {
    const roleDestination = await getRoleDestination(userId, getPostLoginDestination());

    if (roleDestination === "/account/suspended" || roleDestination === "/account/unavailable" || roleDestination === "/account/setup-error") {
      window.location.href = roleDestination;
      return;
    }

    if (hasPendingSso()) {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      await finishDiscourseSso(session?.access_token ?? "");
      return;
    }

    window.location.href = roleDestination;
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

        const roleDestination = await getRoleDestination(userId, getPostLoginDestination());
        if (roleDestination) {
          navigate(roleDestination, { replace: true });
          return;
        }

        if (isBlockedStatus(approvalStatus)) {
          await supabase.auth.signOut();
          setError(getApprovalMessage(approvalStatus));
          return;
        }

        navigate(getKycPendingUrl(approvalStatus), { replace: true });
      } catch {
        if (!isMounted) {
          return;
        }

        setError(
          "Unable to verify your account status right now. Please try again, or contact support if the issue continues."
        );
      }
    };

    if (q.get("next") === "/sso" && (!q.get("sso") || !q.get("sig"))) {
      setError(getSsoSessionExpiredMessage());
    }

    checkExistingSession();

    return () => {
      isMounted = false;
    };
  }, [navigate, getPostLoginDestination, q]);

  const signInWithFallback = async () => {
    const normalizedIdentifier = loginIdentifier.trim().toLowerCase();
    const isEmailLogin = normalizedIdentifier.includes("@");

    if (isEmailLogin) {
      const firstAttempt = await supabase.auth.signInWithPassword({
        email: normalizedIdentifier,
        password,
      });

      if (!firstAttempt.error) {
        return firstAttempt;
      }
    }

    const { data: bootstrapResult, error: bootstrapError } = await supabase.functions.invoke(
      "bootstrap-login",
      { body: { identifier: normalizedIdentifier, password } },
    );

    if (bootstrapError || !bootstrapResult?.ok || !bootstrapResult.session) {
      return {
        data: { user: null, session: null },
        error: isEmailLogin
          ? { message: "Invalid login credentials" }
          : { message: "Invalid username or password" },
      };
    }

    return supabase.auth.setSession({
      access_token: bootstrapResult.session.access_token,
      refresh_token: bootstrapResult.session.refresh_token,
    });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError(null);

    const { data: signInData, error } = await signInWithFallback();

    if (error) {
      const message =
        error.message.toLowerCase().includes("sso") ||
        error.message.toLowerCase().includes("session")
          ? getSsoSessionExpiredMessage()
          : error.message;
      setError(message);
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      setError(
        message === "sso_session_expired"
          ? getSsoSessionExpiredMessage()
          : "Unable to verify your account status right now. Please try again, or contact support if the issue continues."
      );

      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <PageSection>
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-[#D6EBF5] rounded-full flex items-center justify-center mb-4">
            <LogIn className="w-8 h-8 text-[#4B9EC8]" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome Back
          </h1>

          <p className="text-gray-600">
            Log in to your Tea Time Cari account
          </p>
        </div>

        {error && (
          <StatusAlert variant="error" className="mb-6">
            <span>{error}</span>
            <p className="mt-2">
              Need help?{' '}
              <Link to="/contact-us?topic=account-status" className="font-semibold underline">Contact support</Link>.
            </p>
          </StatusAlert>
        )}

        <form name="login" method="POST" data-netlify="true" onSubmit={onSubmit} className="space-y-6">
          <input type="hidden" name="form-name" value="login" readOnly />
          <FormField id="loginIdentifier" label="Email Address or Username">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>

              <input
                type="text"
                id="loginIdentifier"
                name="loginIdentifier"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300 bg-white hover:border-[#4B9EC8]"
                placeholder="Enter your email address or username"
                required
                disabled={loading}
                autoComplete="username"
              />
            </div>
          </FormField>

          <FormField id="password" label="Password">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>

              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300 bg-white hover:border-[#4B9EC8]"
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
          </FormField>

          <PrimaryButton
            type="submit"
            disabled={loading || !loginIdentifier || !password}
            isLoading={loading}
            loadingLabel="Logging in..."
            icon={<LogIn className="h-5 w-5" />}
          >
            Log In
          </PrimaryButton>
        </form>

        <div className="mt-8 space-y-4">
          <div className="text-center">
            <Link
              to="/forgot-password"
              className="text-sm text-[#4B9EC8] hover:text-[#3382AA] transition-colors font-medium"
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

        <PrivacyNote className="mt-8" title="New to Tea Time Cari?">
          You'll need an invitation to join our community.
        </PrivacyNote>
      </PageSection>
    </AuthLayout>
  );
}
