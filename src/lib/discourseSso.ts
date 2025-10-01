// src/lib/discourseSso.ts
const SSO_COMPLETE_URL = "https://nxzfrnpsiqpxibhggoct.functions.supabase.co/sso-complete";
const RETURN_FALLBACK = "https://community.teatimecari.app/session/sso_login";

const N_KEY = "disc_nonce";
const R_KEY = "disc_return";

export function stashFromUrlOnce() {
  const sp = new URLSearchParams(window.location.search);
  const n = sp.get("sso_nonce");
  const r = sp.get("r");
  if (n) sessionStorage.setItem(N_KEY, n);
  if (r) sessionStorage.setItem(R_KEY, r);
}

export function hasPendingSso() {
  return Boolean(sessionStorage.getItem(N_KEY));
}

export async function finishDiscourseSso(sessionToken: string) {
  const nonce = sessionStorage.getItem(N_KEY);
  const ret = sessionStorage.getItem(R_KEY) || RETURN_FALLBACK;
  if (!nonce || !sessionToken) return false;

  const res = await fetch(SSO_COMPLETE_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${sessionToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ nonce, returnUrl: ret }),
  });

  if (!res.ok) {
    console.error("[finishDiscourseSso] failed", await res.text());
    return false;
  }
  const { redirectUrl } = await res.json();
  if (redirectUrl) {
    // clear so we don't loop on refresh
    sessionStorage.removeItem(N_KEY);
    sessionStorage.removeItem(R_KEY);
    window.location.href = redirectUrl;
    return true;
  }
  return false;
}