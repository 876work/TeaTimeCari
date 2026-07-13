import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Flag, Loader2, Lock, MessageCircle, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { normalizeApprovalStatus } from "@/lib/auth/approvalStatus";

const discourseBaseUrl = import.meta.env.VITE_DISCOURSE_BASE_URL || "https://community.teatimecari.app";
const defaultReturnPath = import.meta.env.VITE_DISCOURSE_DEFAULT_RETURN_PATH || "/";
const genderReturnPaths: Record<string, string> = {
  male: import.meta.env.VITE_DISCOURSE_MEN_CATEGORY_PATH || "/c/user-photos/men-photos-slu/6",
  men: import.meta.env.VITE_DISCOURSE_MEN_CATEGORY_PATH || "/c/user-photos/men-photos-slu/6",
  female: import.meta.env.VITE_DISCOURSE_WOMEN_CATEGORY_PATH || "/c/user-photos/women-photos-slu/7",
  women: import.meta.env.VITE_DISCOURSE_WOMEN_CATEGORY_PATH || "/c/user-photos/women-photos-slu/7",
};

type RegistrationCommunityAccess = {
  gender?: string | null;
  status?: string | null;
  community_onboarding_completed_at?: string | null;
};

type RedirectState =
  | { kind: "loading" }
  | { kind: "onboarding"; returnPath: string; gender?: string | null; error?: string | null; isSaving?: boolean };

const communityRules = [
  "Share only what you personally know or can reasonably support.",
  "Protect privacy: do not expose addresses, workplaces, IDs, private messages, or unnecessary personal details.",
  "Keep the tone respectful and safety-focused. No harassment, threats, pile-ons, or revenge posting.",
];

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

function getCommunityCategoryLabel(gender?: string | null) {
  const genderKey = gender?.trim().toLowerCase();

  if (genderKey === "male" || genderKey === "men") return "men's private category";
  if (genderKey === "female" || genderKey === "women") return "women's private category";

  return "your assigned private category";
}

function redirectToDiscourse(returnPath: string) {
  const base = discourseBaseUrl.replace(/\/+$/, "");
  window.location.replace(`${base}/session/sso?return_path=${encodeURIComponent(returnPath)}`);
}

function OnboardingScreen({
  error,
  gender,
  isSaving,
  onContinue,
}: {
  error?: string | null;
  gender?: string | null;
  isSaving?: boolean;
  onContinue: () => void;
}) {
  const categoryLabel = useMemo(() => getCommunityCategoryLabel(gender), [gender]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-rose-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
          <div className="bg-gradient-to-r from-[#4B9EC8] to-[#D96E6E] px-6 py-8 text-white sm:px-10">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
              <ShieldCheck className="h-8 w-8" aria-hidden="true" />
            </div>
            <p className="text-sm font-bold uppercase tracking-[0.32em] text-white/80">Approved access</p>
            <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">Welcome to the community</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/90">
              Before you enter Discourse for the first time, take a moment to review how Tea Time Cari keeps the space private,
              useful, and safer for everyone.
            </p>
          </div>

          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="space-y-7 p-6 sm:p-10">
              <div>
                <div className="mb-4 flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden="true" />
                  <h2 className="text-xl font-bold text-slate-900">Three rules to remember</h2>
                </div>
                <ol className="space-y-3">
                  {communityRules.map((rule, index) => (
                    <li key={rule} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#4B9EC8] text-sm font-bold text-white">
                        {index + 1}
                      </span>
                      <span className="text-sm leading-6 text-slate-700">{rule}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
                <div className="mb-2 flex items-center gap-3">
                  <Users className="h-5 w-5 text-[#3382AA]" aria-hidden="true" />
                  <h2 className="font-bold text-slate-900">Where you are going</h2>
                </div>
                <p className="text-sm leading-6 text-slate-700">
                  You will open {categoryLabel} first. Categories are separated so members can compare notes with the right
                  audience, and moderators can review conversations with better context. Use the category that matches your
                  assigned access group and avoid moving private content between spaces.
                </p>
              </div>
            </section>

            <aside className="border-t border-slate-200 bg-slate-50 p-6 sm:p-10 lg:border-l lg:border-t-0">
              <div className="space-y-5">
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <div className="mb-3 flex items-center gap-3">
                    <Flag className="h-5 w-5 text-[#D96E6E]" aria-hidden="true" />
                    <h2 className="font-bold text-slate-900">If something feels unsafe</h2>
                  </div>
                  <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
                    <li>Use Discourse's flag/report option on the post, reply, or message.</li>
                    <li>Add a clear reason so moderators know what to review.</li>
                    <li>If there is urgent real-world risk, contact local emergency support first, then alert Tea Time Cari.</li>
                  </ol>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <div className="mb-3 flex items-center gap-3">
                    <Lock className="h-5 w-5 text-slate-700" aria-hidden="true" />
                    <h2 className="font-bold text-slate-900">Privacy reminder</h2>
                  </div>
                  <p className="text-sm leading-6 text-slate-700">
                    Treat community posts, private messages, and anonymous content as confidential. Do not screenshot, repost,
                    forward, or identify people outside the approved space.
                  </p>
                </div>

                {error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4" role="alert">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" aria-hidden="true" />
                      <p className="text-sm leading-6 text-red-700">{error}</p>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={onContinue}
                  disabled={isSaving}
                  className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#4B9EC8] to-[#D96E6E] px-6 py-4 font-bold text-white shadow-lg transition-all hover:from-[#3382AA] hover:to-[#BC5050] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" /> : <MessageCircle className="mr-2 h-5 w-5" aria-hidden="true" />}
                  Open my community space
                </button>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function CommunityRedirect() {
  const [redirectState, setRedirectState] = useState<RedirectState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    const redirect = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user?.id) {
          window.location.replace("/login?redirectTo=/community");
          return;
        }

        const { data, error } = await supabase
          .from("registrations")
          .select("gender, status, community_onboarding_completed_at")
          .eq("id", session.user.id)
          .maybeSingle<RegistrationCommunityAccess>();

        if (cancelled) return;

        if (error) {
          console.warn("Unable to load community access details; using default Discourse landing page.", error);
          redirectToDiscourse(normalizeReturnPath(defaultReturnPath));
          return;
        }

        const status = normalizeApprovalStatus(data?.status);

        if (status !== "approved") {
          window.location.replace("/kyc-pending");
          return;
        }

        const returnPath = getReturnPathForGender(data?.gender);

        if (!data?.community_onboarding_completed_at) {
          setRedirectState({ kind: "onboarding", returnPath, gender: data?.gender });
          return;
        }

        redirectToDiscourse(returnPath);
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

  const completeOnboarding = async () => {
    if (redirectState.kind !== "onboarding") return;

    setRedirectState({ ...redirectState, error: null, isSaving: true });

    try {
      const { error } = await supabase.rpc("mark_community_onboarding_complete");

      if (error) throw error;

      redirectToDiscourse(redirectState.returnPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save your onboarding confirmation.";
      setRedirectState({ ...redirectState, error: message, isSaving: false });
    }
  };

  if (redirectState.kind === "onboarding") {
    return (
      <OnboardingScreen
        error={redirectState.error}
        gender={redirectState.gender}
        isSaving={redirectState.isSaving}
        onContinue={completeOnboarding}
      />
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 via-white to-rose-50 px-4">
      <div className="text-center">
        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#4B9EC8]" aria-hidden="true" />
        <p className="text-sm text-slate-500">Opening your community category…</p>
      </div>
    </main>
  );
}
