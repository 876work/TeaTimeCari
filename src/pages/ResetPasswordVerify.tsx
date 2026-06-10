import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Lock } from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { PageSection, StatusAlert } from "../components/Form";

type RecoveryLinkResult =
  | { ok: true; confirmationUrl: string }
  | { ok: false; message: string };

function getAllowedResetOrigin() {
  const configuredSiteUrl = import.meta.env.VITE_PUBLIC_SITE_URL;

  if (configuredSiteUrl) {
    return new URL(configuredSiteUrl).origin;
  }

  return window.location.origin;
}

function getAllowedSupabaseOrigin() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  if (!supabaseUrl) return null;

  return new URL(supabaseUrl).origin;
}

function isAllowedResetRedirect(redirectTo: string, allowedResetOrigin: string) {
  const redirectUrl = new URL(redirectTo);

  return redirectUrl.origin === allowedResetOrigin && redirectUrl.pathname === "/reset-password";
}

function parseRecoveryLink(): RecoveryLinkResult {
  const params = new URLSearchParams(window.location.search);
  const allowedResetOrigin = getAllowedResetOrigin();
  const allowedSupabaseOrigin = getAllowedSupabaseOrigin();

  if (!allowedSupabaseOrigin) {
    return {
      ok: false,
      message: "Password reset is not configured correctly. Please contact support.",
    };
  }

  const rawConfirmationUrl = params.get("confirmation_url");

  if (!rawConfirmationUrl) {
    return {
      ok: false,
      message: "This password reset link is missing required information. Please request a new one.",
    };
  }

  try {
    const confirmationUrl = new URL(rawConfirmationUrl);
    const confirmationRedirectTo = confirmationUrl.searchParams.get("redirect_to");

    if (
      confirmationUrl.origin !== allowedSupabaseOrigin ||
      confirmationUrl.pathname !== "/auth/v1/verify" ||
      confirmationUrl.searchParams.get("type") !== "recovery" ||
      !confirmationUrl.searchParams.get("token") ||
      !confirmationRedirectTo ||
      !isAllowedResetRedirect(confirmationRedirectTo, allowedResetOrigin)
    ) {
      throw new Error("Unexpected confirmation URL");
    }

    return { ok: true, confirmationUrl: confirmationUrl.toString() };
  } catch {
    return {
      ok: false,
      message: "This password reset link is invalid. Please request a new one.",
    };
  }
}

export default function ResetPasswordVerify() {
  const recoveryLink = useMemo(() => parseRecoveryLink(), []);

  return (
    <AuthLayout>
      <PageSection>
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#D6EBF5]">
            <Lock className="h-8 w-8 text-[#4B9EC8]" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Continue to password reset</h1>
          <p className="text-gray-600">
            For your security, confirm that you want to continue before we verify your reset link.
          </p>
        </div>

        {recoveryLink.ok ? (
          <div className="space-y-6">
            <StatusAlert variant="info">
              You clicked a Tea Time Cari reset link. Continue to open the secure password reset page.
            </StatusAlert>

            <a
              href={recoveryLink.confirmationUrl}
              className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700"
            >
              Continue securely
              <ArrowRight className="ml-2 h-5 w-5" />
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            <StatusAlert variant="error">{recoveryLink.message}</StatusAlert>

            <Link
              to="/forgot-password"
              className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700"
            >
              Request a new reset email
            </Link>
          </div>
        )}
      </PageSection>
    </AuthLayout>
  );
}
