import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { FormField, PageSection, PrimaryButton, StatusAlert } from "../components/Form";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<null | { ok: boolean; msg: string }>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // When user lands here via email link, Supabase sets a session in local storage.
    // If there's no session, they likely hit the page directly; show a friendly note.
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setStatus({
          ok: false,
          msg: "Reset link invalid or expired. Please request a new one.",
        });
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
    else {
      setStatus({ ok: true, msg: "Password updated. You can now sign in." });
      // Optional: if this reset was initiated during a Discourse SSO flow,
      // you could redirect to /sso afterwards. For now, just show success.
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
          <StatusAlert variant={status.ok ? "success" : "error"} className="mb-6">
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
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 transition-colors hover:border-[#4B9EC8] focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="new-password"
            />
          </FormField>
          <FormField id="confirm" label="Confirm new password" required>
            <input
              id="confirm"
              type="password"
              name="confirm"
              required
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 transition-colors hover:border-[#4B9EC8] focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="new-password"
            />
          </FormField>
          <PrimaryButton type="submit" isLoading={loading} loadingLabel="Updating password...">
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
