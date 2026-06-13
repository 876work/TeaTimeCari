import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { FormField, PageSection, PrimaryButton, StatusAlert } from "../components/Form";
import { supabase } from "@/lib/supabaseClient";

type ResetStatus = {
  variant: "error" | "success" | "info" | "warning";
  msg: string;
};

const INVALID_RESET_LINK_MESSAGE = "Reset link invalid or expired. Please request a new one.";

function getRecoveryParams() {
  const url = new URL(window.location.href);
  const searchParams = url.searchParams;
  const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);

  return {
    code: searchParams.get("code") ?? hashParams.get("code"),
    tokenHash: searchParams.get("token_hash") ?? hashParams.get("token_hash"),
    type: searchParams.get("type") ?? hashParams.get("type"),
    accessToken: hashParams.get("access_token") ?? searchParams.get("access_token"),
    refreshToken: hashParams.get("refresh_token") ?? searchParams.get("refresh_token"),
    authError:
      searchParams.get("error_description") ??
      hashParams.get("error_description") ??
      searchParams.get("error") ??
      hashParams.get("error"),
  };
}

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<ResetStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  useEffect(() => {
    let mounted = true;

    const markRecoveryReady = () => {
      if (!mounted) return;

      setHasRecoverySession(true);
      setStatus(null);
      setCheckingLink(false);
    };

    const cleanRecoveryParams = () => {
      const url = new URL(window.location.href);
      [
        "access_token",
        "code",
        "error",
        "error_code",
        "error_description",
        "expires_at",
        "expires_in",
        "refresh_token",
        "token_hash",
        "type",
      ].forEach((param) => {
        url.searchParams.delete(param);
      });
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
        markRecoveryReady();
      }
    });

    const verifyRecoveryLink = async () => {
      const { code, tokenHash, type, accessToken, refreshToken, authError } = getRecoveryParams();

      if (authError) {
        if (mounted) {
          setStatus({
            variant: "error",
            msg: decodeURIComponent(authError).replace(/\+/g, " "),
          });
          setCheckingLink(false);
        }
        return;
      }

      if (code) {
        if (mounted) {
          setStatus({ variant: "info", msg: "Verifying your password reset link…" });
        }

        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          const { data } = await supabase.auth.getSession();

          if (data.session) {
            markRecoveryReady();
            cleanRecoveryParams();
          } else if (mounted) {
            setStatus({
              variant: "error",
              msg: INVALID_RESET_LINK_MESSAGE,
            });
          }

          if (mounted) setCheckingLink(false);
          return;
        }

        markRecoveryReady();
        cleanRecoveryParams();
        return;
      }

      if (tokenHash && type === "recovery") {
        if (mounted) {
          setStatus({ variant: "info", msg: "Verifying your password reset link…" });
        }

        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });

        if (error) {
          const { data } = await supabase.auth.getSession();

          if (data.session) {
            markRecoveryReady();
            cleanRecoveryParams();
          } else if (mounted) {
            setStatus({
              variant: "error",
              msg: INVALID_RESET_LINK_MESSAGE,
            });
            setCheckingLink(false);
          }

          return;
        }

        markRecoveryReady();
        cleanRecoveryParams();
        return;
      }

      if (accessToken && refreshToken && type === "recovery") {
        if (mounted) {
          setStatus({ variant: "info", msg: "Verifying your password reset link…" });
        }

        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error && mounted) {
          setStatus({
            variant: "error",
            msg: INVALID_RESET_LINK_MESSAGE,
          });
          setCheckingLink(false);
          return;
        }

        markRecoveryReady();
        cleanRecoveryParams();
        return;
      }

      const { data } = await supabase.auth.getSession();

      if (data.session) {
        markRecoveryReady();
      } else if (mounted) {
        setStatus({
          variant: "warning",
          msg: INVALID_RESET_LINK_MESSAGE,
        });
      }

      if (mounted) setCheckingLink(false);
    };

    verifyRecoveryLink();

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!hasRecoverySession) {
      setStatus({ variant: "error", msg: "Please open a valid password reset link before setting a new password." });
      return;
    }

    if (password.length < 10) {
      setStatus({ variant: "error", msg: "Password must be at least 10 characters long." });
      return;
    }

    if (password !== confirm) {
      setStatus({ variant: "error", msg: "Passwords do not match." });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setStatus({ variant: "error", msg: error.message });
    } else {
      setStatus({ variant: "success", msg: "Password updated. You can now sign in." });
      setPassword("");
      setConfirm("");
    }
  }

  return (
    <AuthLayout>
      <PageSection>
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#D6EBF5]">
            <Lock className="h-8 w-8 text-[#4B9EC8]" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Set a new password</h1>
          <p className="text-gray-600">Choose a secure password for your Tea Time Cari account.</p>
        </div>

        {status && (
          <StatusAlert variant={status.variant} className="mb-6">
            {status.msg}
          </StatusAlert>
        )}

        <form name="reset-password" method="POST" data-netlify="true" onSubmit={onSubmit} className="space-y-6">
          <input type="hidden" name="form-name" value="reset-password" readOnly />
          <FormField id="password" label="New password" required>
            <input
              id="password"
              type="password"
              name="password"
              required
              minLength={10}
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 transition-colors hover:border-[#4B9EC8] focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="new-password"
              disabled={checkingLink || loading}
            />
          </FormField>
          <FormField id="confirm" label="Confirm new password" required>
            <input
              id="confirm"
              type="password"
              name="confirm"
              required
              minLength={10}
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 transition-colors hover:border-[#4B9EC8] focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="new-password"
              disabled={checkingLink || loading}
            />
          </FormField>
          <PrimaryButton
            type="submit"
            disabled={checkingLink || loading || !hasRecoverySession}
            isLoading={loading || checkingLink}
            loadingLabel={checkingLink ? "Verifying reset link..." : "Updating password..."}
          >
            Update password
          </PrimaryButton>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Need a new link? <Link to="/forgot-password" className="font-medium text-[#4B9EC8] hover:text-[#3382AA]">Request another reset email</Link>.
        </p>
      </PageSection>
    </AuthLayout>
  );
}
