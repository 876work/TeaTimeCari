import { useEffect, useState } from "react";
import { supabase } from '@/lib/supabaseClient';

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
    <div className="mx-auto max-w-sm p-6">
      <h1 className="text-xl font-semibold mb-4">Set a new password</h1>
      <form name="reset-password" method="POST" data-netlify="true" onSubmit={onSubmit} className="space-y-4">
        <input type="hidden" name="form-name" value="reset-password" readOnly />
        <input
          type="password"
          name="password"
          required
          placeholder="New password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
        <input
          type="password"
          name="confirm"
          required
          placeholder="Confirm new password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-black text-white py-2"
        >
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
      {status && (
        <p className={`mt-4 text-sm ${status.ok ? "text-green-700" : "text-red-700"}`}>
          {status.msg}
        </p>
      )}
    </div>
  );
}
