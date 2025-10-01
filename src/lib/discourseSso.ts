// src/lib/discourseSso.ts
const N_KEY = "disc_nonce";
const R_KEY = "disc_return";

// Supabase Edge Function endpoint that builds the Discourse redirect
const COMPLETE_URL =
  "https://nxzfrnpsiqpxibhggoct.functions.supabase.co/sso-complete";

// Safety default if "r" is missing
const RETURN_FALLBACK =
  "https://community.teatimecari.app/session/sso_login";

/** Save sso_nonce & r from the current URL into sessionStorage (idempotent). */
export function stashFromUrlOnce() {
  try {
    const sp = new URLSearchParams(window.location.search);
    const n = sp.get("sso_nonce");
    const r = sp.get("r");
    if (n && !sessionStorage.getItem(N_KEY)) sessionStorage.setItem(N_KEY, n);
    if (r && !sessionStorage.getItem(R_KEY)) sessionStorage.setItem(R_KEY, r);
  } catch {}
}

/** True if there is a pending SSO handshake (in storage or URL). */
export function hasPendingSso(): boolean {
  if (sessionStorage.getItem(N_KEY)) return true;
  try {
    const sp = new URLSearchParams(window.location.search);
    return !!sp.get("sso_nonce");
  } catch {
    return false;
  }
}

/**
 * Finish the Discourse SSO handshake:
 * - reads nonce/return from storage OR current URL (fallback)
 * - calls the sso-complete function with the Supabase session token
 * - clears storage and redirects the browser
 */
export async function finishDiscourseSso(sessionToken: string) {
  // fall back to current URL if storage is empty
  const sp = new URLSearchParams(window.location.search);
  const nonce =
    sessionStorage.getItem(N_KEY) || sp.get("sso_nonce") || undefined;
  const returnUrl =
    sessionStorage.getItem(R_KEY) || sp.get("r") || RETURN_FALLBACK;

  if (!nonce) return false;

  const res = await fetch(COMPLETE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ nonce, returnUrl }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || "sso-complete failed");
  }

  // Clean up and bounce back to Discourse
  try {
    sessionStorage.removeItem(N_KEY);
    sessionStorage.removeItem(R_KEY);
  } catch {}

  if (json?.redirectUrl) {
    window.location.replace(json.redirectUrl);
    return true;
  }

  // last-resort safety
  window.location.replace(
    `${RETURN_FALLBACK}?sso=${encodeURIComponent(
      json?.b64 || ""
    )}&sig=${json?.sig || ""}`
  );
  return true;
}