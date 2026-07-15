// Central config for the Stage 1 cross-access service.
// All defaults are safe, local, and dummy. No production values live here.

import process from "node:process";

export const config = {
  port: Number(process.env.PORT || 4300),
  ssoSecret: process.env.DISCOURSE_SSO_SECRET || "stage1-dummy-sso-secret-do-not-use-in-prod",
  xaccessGroup: process.env.XACCESS_GROUP || "xaccess",
  workerIntervalMs: Number(process.env.WORKER_INTERVAL_MS || 5000),
  // Empty in Stage 1 => use the in-process mock Discourse. A real base URL flips
  // the sync to a live Discourse admin endpoint in Stage 2+ (not wired here on purpose).
  discourseBaseUrl: (process.env.DISCOURSE_BASE_URL || "").trim(),
  stage: 1,
};
