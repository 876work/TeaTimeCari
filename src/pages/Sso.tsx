import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { supabase } from '@/lib/supabaseClient';
import { AuthLayout } from "@/components/AuthLayout";
import { LoadingCard } from "@/components/Form";
import { getFunctionErrorMessage } from "@/lib/functionError";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function Sso() {
  const q = useQuery();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const sso = q.get("sso") || "";
      const sig = q.get("sig") || "";

      if (!sso || !sig) {
        setErrorMsg("Your community sign-in session expired or is missing required security details. Please start again from the Community link.");
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        navigate("/login?redirectTo=/community", { replace: true });
        return;
      }

      const { data, error } = await supabase.functions.invoke("sso-complete", {
        body: { sso, sig },
      });

      if (error) {
        const detail = await getFunctionErrorMessage(error);
        console.error("sso-complete error:", detail);

        if (detail.includes("unrecognized_gender")) {
          setErrorMsg("We couldn't confirm your community access group. Please contact support so we can fix this for you.");
        } else if (detail.includes("unauthorized") || detail.includes("missing token") || detail.includes("missing nonce")) {
          setErrorMsg("Your community sign-in session may have expired. Please start again from the Community link.");
        } else {
          setErrorMsg("We ran into a problem finishing your community sign-in. Please try again, or contact support if this keeps happening.");
        }
        return;
      }

      const redirectUrl = (data?.redirectUrl || data?.redirect) as string | undefined;
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        setErrorMsg("We could not finish community sign-in. Please start again from the Community link, or contact support if this keeps happening.");
      }
    })();
  }, [navigate, q]);

  if (errorMsg) {
    return (
      <AuthLayout>
        <div className="rounded-2xl bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <AlertCircle className="h-8 w-8 text-red-500" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Community sign-in needs attention</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">{errorMsg}</p>
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

  return (
    <AuthLayout>
      <LoadingCard
        title="Connecting you to the community"
        message="Just a moment while we sign you in…"
      />
    </AuthLayout>
  );
}
