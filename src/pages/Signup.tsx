import { useState } from "react";
import { AuthLayout } from "../components/AuthLayout";
import { registerAndSignIn, type SignupForm } from "@/lib/auth/register";
import { AlertCircle, Loader2, UserPlus } from "lucide-react";

export default function Signup() {
  const [form, setForm] = useState<SignupForm>({
    email: "",
    password: "",
    username: "",
    firstName: "",
    lastName: "",
    full_name: "",
    gender: "Female",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const { next } = await registerAndSignIn(form);
      if (typeof next === "string") window.location.href = next;
    } catch (e: any) {
      setErr(e?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="dark-form-box w-full max-w-md mx-auto px-10 py-12">
        <div className="text-center mb-10">
          <div
            className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, #A3C6E0, #E0A3A3)" }}
          >
            <UserPlus className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Create Account</h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
            Join the Tea Time Cari community
          </p>
        </div>

        {err && (
          <div className="dark-alert-error">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{err}</span>
          </div>
        )}

        <form onSubmit={onSubmit}>
          <div className={`form-field ${form.email ? "has-value" : ""}`}>
            <input
              required
              type="email"
              id="su-email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <label htmlFor="su-email">Email</label>
          </div>

          <div className={`form-field ${form.password ? "has-value" : ""}`}>
            <input
              required
              type="password"
              id="su-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <label htmlFor="su-password">Password</label>
          </div>

          <div className={`form-field ${form.username ? "has-value" : ""}`}>
            <input
              type="text"
              id="su-username"
              value={form.username || ""}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
            <label htmlFor="su-username">Username (optional)</label>
          </div>

          <div className="flex gap-4">
            <div className={`form-field flex-1 ${form.firstName ? "has-value" : ""}`}>
              <input
                type="text"
                id="su-fname"
                value={form.firstName || ""}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
              <label htmlFor="su-fname">First Name</label>
            </div>
            <div className={`form-field flex-1 ${form.lastName ? "has-value" : ""}`}>
              <input
                type="text"
                id="su-lname"
                value={form.lastName || ""}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
              <label htmlFor="su-lname">Last Name</label>
            </div>
          </div>

          <div className={`form-field ${form.gender ? "has-value" : ""}`}>
            <select
              id="su-gender"
              value={form.gender || "Female"}
              onChange={(e) => setForm({ ...form, gender: e.target.value as "Male" | "Female" })}
            >
              <option value="Female">Female</option>
              <option value="Male">Male</option>
            </select>
            <label htmlFor="su-gender">Gender</label>
          </div>

          <div className="text-center mt-4">
            <button
              type="submit"
              disabled={loading}
              className="dark-btn"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2 normal-case tracking-normal">
                  <Loader2 className="animate-spin w-4 h-4" /> Creating account...
                </span>
              ) : (
                <>
                  Create Account
                  <span />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
