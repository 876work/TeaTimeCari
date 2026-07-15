// DiscourseConnect payload signing for the Stage 2 Edge Functions (Deno/WebCrypto).
//
// This is intentionally identical in wire format to the production helper at
// supabase/functions/_shared/sso.ts, and to the Stage 1 Node port
// (cross-access-service/src/sso.mjs) which was verified to produce signatures a
// Discourse endpoint accepts:
//
//   qs  = querystring(payload)
//   b64 = base64(qs)
//   sig = hex( HMAC_SHA256(b64, secret) )
//
// Because all three implementations share this format, the remove_groups payloads
// the Stage 2 worker signs will validate against the same Discourse instance the
// production login path already talks to.

export async function hmacHex(input: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toQueryString(obj: Record<string, string>): string {
  return new URLSearchParams(obj).toString();
}

export async function signSsoPayload(
  obj: Record<string, string>,
  secret: string,
): Promise<{ b64: string; sig: string }> {
  const qs = toQueryString(obj);
  const b64 = btoa(qs);
  const sig = await hmacHex(b64, secret);
  return { b64, sig };
}

/**
 * Build the DiscourseConnect fields for a revocation. `remove_groups` is the
 * DiscourseConnect parameter that ends a timed grant — the counterpart to
 * `add_groups`, unused in production today (see the research brief).
 */
export function buildRevocationPayload(opts: {
  externalId: string;
  username: string;
  email: string;
  xaccessGroup: string;
  nonce?: string;
}): Record<string, string> {
  return {
    nonce: opts.nonce ?? crypto.randomUUID(),
    external_id: String(opts.externalId),
    email: opts.email,
    username: opts.username,
    remove_groups: opts.xaccessGroup,
  };
}
