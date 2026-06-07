import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

const discourseBaseUrl = import.meta.env.VITE_DISCOURSE_BASE_URL || "https://community.teatimecari.app";
const defaultReturnPath = import.meta.env.VITE_DISCOURSE_DEFAULT_RETURN_PATH || "/";
const genderReturnPaths: Record<string, string> = {
  male: import.meta.env.VITE_DISCOURSE_MEN_CATEGORY_PATH || "/c/user-photos/men-photos-slu/6",
  men: import.meta.env.VITE_DISCOURSE_MEN_CATEGORY_PATH || "/c/user-photos/men-photos-slu/6",
  female: import.meta.env.VITE_DISCOURSE_WOMEN_CATEGORY_PATH || "/c/user-photos/women-photos-slu/7",
  women: import.meta.env.VITE_DISCOURSE_WOMEN_CATEGORY_PATH || "/c/user-photos/women-photos-slu/7",
};

function normalizeReturnPath(pathOrUrl: string) {
  try {
    const base = new URL(discourseBaseUrl);
    const url = new URL(pathOrUrl, base.origin);

    if (url.origin !== base.origin) {
      return defaultReturnPath;
    }

    return `${url.pathname}${url.search}${url.hash}` || defaultReturnPath;
  } catch {
    return defaultReturnPath;
  }
}

function getReturnPathForGender(gender?: string | null) {
  const genderKey = gender?.trim().toLowerCase();
  const returnPath = genderKey ? genderReturnPaths[genderKey] : null;
  return normalizeReturnPath(returnPath || defaultReturnPath);
}

function redirectToDiscourse(returnPath: string) {
  const base = discourseBaseUrl.replace(/\/+$/, "");
  window.location.replace(`${base}/session/sso?return_path=${encodeURIComponent(returnPath)}`);
}

export default function CommunityRedirect() {
  useEffect(() => {
    let cancelled = false;

    const redirect = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user?.id) {
          redirectToDiscourse(normalizeReturnPath(defaultReturnPath));
          return;
        }

        const { data, error } = await supabase
          .from("registrations")
          .select("gender")
          .eq("id", session.user.id)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.warn("Unable to load community category; using default Discourse landing page.", error);
        }

        redirectToDiscourse(getReturnPathForGender(data?.gender));
      } catch (error) {
        if (cancelled) return;
        console.warn("Unable to determine community category; using default Discourse landing page.", error);
        redirectToDiscourse(normalizeReturnPath(defaultReturnPath));
      }
    };

    redirect();

    return () => {
      cancelled = true;
    };
  }, []);

  return <p className="p-6 text-center text-sm text-slate-500">Opening your community category…</p>;
}
