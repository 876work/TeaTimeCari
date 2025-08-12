/**
 * Shared SSO utilities for Discourse integration
 */

/**
 * Generate HMAC-SHA256 hex signature
 */
export async function hmacHex(input: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Convert object to query string
 */
function toQueryString(obj: Record<string, string>): string {
  return new URLSearchParams(obj).toString();
}

/**
 * Sign SSO payload for Discourse
 */
export async function signSsoPayload(obj: Record<string, string>, secret: string): Promise<{ b64: string; sig: string }> {
  const qs = toQueryString(obj);
  const b64 = btoa(qs);
  const sig = await hmacHex(b64, secret);
  return { b64, sig };
}

/**
 * Parse and verify incoming SSO request from Discourse
 */
export async function parseAndVerifyIncoming(sso: string, sig: string, secret: string): Promise<URLSearchParams> {
  // Verify signature
  const expectedSig = await hmacHex(sso, secret);
  if (sig !== expectedSig) {
    throw new Error("Invalid SSO signature");
  }

  // Decode and parse payload
  let decodedPayload: string;
  try {
    decodedPayload = atob(sso);
  } catch (err) {
    throw new Error("Invalid Base64 SSO payload");
  }

  return new URLSearchParams(decodedPayload);
}

/**
 * Build groups string for Discourse
 */
export function buildDiscourseGroups(gender: 'men' | 'women', xaccess: boolean): string {
  const groups: string[] = [];
  
  // Add gender group
  const menGroup = Deno.env.get("MEN_GROUP") || "men";
  const womenGroup = Deno.env.get("WOMEN_GROUP") || "women";
  
  if (gender === 'men') {
    groups.push(menGroup);
  } else if (gender === 'women') {
    groups.push(womenGroup);
  }
  
  // Add cross-access group if enabled
  if (xaccess) {
    const xaccessGroup = Deno.env.get("XACCESS_GROUP");
    if (xaccessGroup && xaccessGroup.trim()) {
      groups.push(xaccessGroup.trim());
    }
  }
  
  return groups.join(',');
}

/**
 * Sync user to Discourse via admin API
 */
export async function syncUserToDiscourse(userPayload: Record<string, string>): Promise<void> {
  const discourseBaseUrl = Deno.env.get("DISCOURSE_BASE_URL");
  const discourseApiKey = Deno.env.get("DISCOURSE_ADMIN_API_KEY");
  const discourseApiUsername = Deno.env.get("DISCOURSE_ADMIN_API_USERNAME");
  const discourseSsoSecret = Deno.env.get("DISCOURSE_SSO_SECRET");

  if (!discourseBaseUrl || !discourseApiKey || !discourseApiUsername || !discourseSsoSecret) {
    throw new Error("Missing required Discourse configuration");
  }

  // Sign the payload
  const { b64, sig } = await signSsoPayload(userPayload, discourseSsoSecret);

  // Make API call to Discourse
  const syncUrl = `${discourseBaseUrl.replace(/\/+$/, '')}/admin/users/sync_sso`;
  
  const response = await fetch(syncUrl, {
    method: "POST",
    headers: {
      "Api-Key": discourseApiKey,
      "Api-Username": discourseApiUsername,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: `sso=${encodeURIComponent(b64)}&sig=${sig}`
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Discourse sync failed: ${response.status} ${errorText}`);
  }
}