import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<null | { ok: boolean; msg: string }>(null);
  const [loading, setLoading] = useState(false);

  // Where the magic link will send users after they click the email button
  const redirectBase =
    import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin;
  const redirectTo = `${redirectBase}/reset-password`;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    setLoading(false);
    if (error) setStatus({ ok: false, msg: error.message });
    else setStatus({ ok: true, msg: "Check your email for the reset link." });
  }

  return (
    <div className="mx-auto max-w-sm p-6">
      <h1 className="text-xl font-semibold mb-4">Forgot password</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full border rounded px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-black text-white py-2"
        >
          {loading ? "Sending…" : "Send reset link"}
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