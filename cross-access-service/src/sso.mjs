// DiscourseConnect payload signing — byte-compatible with the production helper
// at supabase/functions/_shared/sso.ts.
//
// Production uses Deno + WebCrypto; this Stage 1 service uses Node's crypto. The
// wire format is identical on purpose so the same signed payloads that this
// worker produces against the mock Discourse will validate against a real
// Discourse admin/users/sync_sso endpoint in Stage 2+.
//
//   qs  = querystring(payload)
//   b64 = base64(qs)
//   sig = hex( HMAC_SHA256(b64, secret) )

import crypto from "node:crypto";

/** hex-encoded HMAC-SHA256, matching hmacHex() in _shared/sso.ts */
export function hmacHex(input, secret) {
  return crypto.createHmac("sha256", secret).update(input).digest("hex");
}

function toQueryString(obj) {
  return new URLSearchParams(obj).toString();
}

/** Sign an outgoing SSO payload → { b64, sig }. Mirrors signSsoPayload(). */
export function signSsoPayload(obj, secret) {
  const qs = toQueryString(obj);
  const b64 = Buffer.from(qs, "utf8").toString("base64");
  const sig = hmacHex(b64, secret);
  return { b64, sig };
}

/** Verify + decode an incoming payload. Mirrors parseAndVerifyIncoming(). */
export function parseAndVerifyIncoming(sso, sig, secret) {
  const expectedSig = hmacHex(sso, secret);
  // constant-time compare to avoid leaking timing information
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("Invalid SSO signature");
  }
  const decoded = Buffer.from(sso, "base64").toString("utf8");
  return new URLSearchParams(decoded);
}

/**
 * Build the DiscourseConnect groups payload fields for a revocation.
 *
 * Production `add_groups` only ever ADDS. To end a timed grant we send the
 * matching `remove_groups` field — the parameter DiscourseConnect exposes for
 * exactly this, which is currently unused in production (see the research brief).
 */
export function buildRevocationPayload({ externalId, username, email, xaccessGroup, nonce }) {
  return {
    nonce: nonce || crypto.randomUUID(),
    external_id: String(externalId),
    email: email || `${username}@stage1.local`,
    username,
    remove_groups: xaccessGroup,
  };
}
