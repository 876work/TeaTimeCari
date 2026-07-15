// Mock Discourse admin endpoint for Stage 1.
//
// Stands in for POST {DISCOURSE_BASE_URL}/admin/users/sync_sso. It does the one
// thing that matters for proving the contract: it re-verifies the HMAC signature
// exactly as a real Discourse would, and reports what group change it "applied".
//
// Because it validates the same signature a real Discourse validates, the signed
// remove_groups payloads this worker produces are already Stage-2 ready — the only
// change later is swapping this call for a real fetch() to the sandbox forum.

import { parseAndVerifyIncoming } from "./sso.mjs";
import { config } from "./config.mjs";

// A small chance of transient failure so you can watch the worker's retry/backoff
// behaviour in the demo. Set to 0 for deterministic runs.
const FLAKE_RATE = Number(process.env.MOCK_FLAKE_RATE || 0);

/**
 * Simulate the Discourse sync_sso admin call.
 * @returns {Promise<{ ok: boolean, status: number, applied?: object, error?: string }>}
 */
export async function mockDiscourseSyncSso({ b64, sig }) {
  // simulate network latency
  await new Promise((r) => setTimeout(r, 40 + Math.random() * 80));

  if (FLAKE_RATE > 0 && Math.random() < FLAKE_RATE) {
    return { ok: false, status: 503, error: "mock discourse temporarily unavailable" };
  }

  let params;
  try {
    params = parseAndVerifyIncoming(b64, sig, config.ssoSecret);
  } catch (err) {
    // This is what a real Discourse returns for a bad signature — proves our signer is correct.
    return { ok: false, status: 403, error: err.message };
  }

  const applied = {
    external_id: params.get("external_id"),
    username: params.get("username"),
    removed_groups: params.get("remove_groups") || null,
    added_groups: params.get("add_groups") || null,
  };

  return { ok: true, status: 200, applied };
}
