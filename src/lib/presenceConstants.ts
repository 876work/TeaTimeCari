// Presence timing policy shared by frontend heartbeat and local UI fallbacks.
// The backend Edge Function remains authoritative for admin presence calculations.
export const APP_HEARTBEAT_INTERVAL_MS = 60_000;
export const PRESENCE_ONLINE_MS = 5 * 60_000;
export const PRESENCE_RECENT_MS = 15 * 60_000;
export const APP_TRACKING_STALE_MS = 30 * 60_000;
