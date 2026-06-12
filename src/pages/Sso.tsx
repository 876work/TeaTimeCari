import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck, AlertCircle } from "lucide-react";
import { supabase } from '@/lib/supabaseClient';
import { AuthLayout } from "@/components/AuthLayout";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function Sso() {
  const q = useQuery();
  const navigate = useNavigate();
  const [msg, setMsg] = useState("Preparing secure community connection…");
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    (async () => {
      const sso = q.get("sso") || "";
      const sig = q.get("sig") || "";

      if (!sso || !sig) {
        setHasError(true);
        setMsg("Your community sign-in session expired or is missing required security details. Please start again from the Community link.");
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        navigate("/login?redirectTo=/community", { replace: true });
        return;
      }

      setMsg("Finishing secure sign-in with the Tea Time Cari community…");

      const { data, error } = await supabase.functions.invoke("sso-complete", {
        body: { sso, sig },
      });

      if (error) {
        console.error("sso-complete error:", error);
        setHasError(true);
        setMsg("Your community sign-in session may have expired. Please start again from the Community link, or contact support if this keeps happening.");
        return;
      }

      const redirectUrl = (data?.redirectUrl || data?.redirect) as string | undefined;
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        setHasError(true);
        setMsg("We could not finish community sign-in. Please start again from the Community link, or contact support if this keeps happening.");
      }
    })();
  }, [navigate, q]);

  return (
    <AuthLayout>
      <div className="rounded-2xl bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#D6EBF5]">
          {hasError ? (
            <AlertCircle className="h-8 w-8 text-red-500" aria-hidden="true" />
          ) : (
            <ShieldCheck className="h-8 w-8 text-[#4B9EC8]" aria-hidden="true" />
          )}
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          {hasError ? 'Community sign-in needs attention' : 'Connecting you to the community'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">{msg}</p>
        {!hasError && (
          <div className="mt-6 flex items-center justify-center text-sm font-medium text-[#4B9EC8]">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
            This may take a few seconds.
          </div>
        )}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link to="/community" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Start community sign-in again
          </Link>
          <Link to="/contact-us?topic=account-status" className="rounded-lg bg-[#4B9EC8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3382AA]">
            Contact support
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
