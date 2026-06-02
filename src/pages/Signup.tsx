// src/pages/Signup.tsx
import { useState } from "react";
import { registerAndSignIn, type SignupForm } from "@/lib/auth/register";

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
      // if next === null, finishDiscourseSso already redirected
    } catch (e: any) {
      setErr(e?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">Create your account</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            required
            type="email"
            className="w-full border rounded p-2"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <input
            required
            type="password"
            className="w-full border rounded p-2"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Username (optional)</label>
          <input
            type="text"
            className="w-full border rounded p-2"
            value={form.username || ""}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">First name</label>
            <input
              type="text"
              className="w-full border rounded p-2"
              value={form.firstName || ""}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Last name</label>
            <input
              type="text"
              className="w-full border rounded p-2"
              value={form.lastName || ""}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1">Gender</label>
          <select
            className="w-full border rounded p-2"
            value={form.gender || "Female"}
            onChange={(e) =>
              setForm({ ...form, gender: e.target.value as "Male" | "Female" })
            }
          >
            <option>Female</option>
            <option>Male</option>
          </select>
        </div>

        {err && <p className="text-red-600 text-sm">{err}</p>}

        <button
          type="submit"
          className="w-full rounded bg-black text-white p-2 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
    </div>
  );
}