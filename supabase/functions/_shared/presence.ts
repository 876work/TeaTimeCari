export type PresenceStatus =
  | "online_app"
  | "online_community"
  | "online_both"
  | "recently_active"
  | "offline"
  | "unknown";

export type ActivitySource = "app" | "community" | "both" | null;

// Presence timing policy. Heartbeats are expected every minute while active.
export const APP_HEARTBEAT_INTERVAL_MS = 60 * 1000;
export const PRESENCE_ONLINE_MS = 5 * 60 * 1000;
export const PRESENCE_RECENT_MS = 15 * 60 * 1000;
export const APP_TRACKING_STALE_MS = 30 * 60 * 1000;

export function toTime(value?: string | null) {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : null;
}

export function newest(a?: string | null, b?: string | null) {
  const at = toTime(a);
  const bt = toTime(b);
  if (at === null) return b ?? null;
  if (bt === null) return a ?? null;
  return at >= bt ? a ?? null : b ?? null;
}

export function calculatePresence(appLastSeen: string | null, communityLastSeen: string | null, now: number) {
  const appTime = toTime(appLastSeen);
  const communityTime = toTime(communityLastSeen);
  if (appTime === null && communityTime === null) {
    return { status: "unknown" as PresenceStatus, lastActivityAt: null, source: null as ActivitySource, appOnline: false, communityOnline: false, appRecent: false, communityRecent: false };
  }
  const appOnline = appTime !== null && now - appTime <= PRESENCE_ONLINE_MS;
  const communityOnline = communityTime !== null && now - communityTime <= PRESENCE_ONLINE_MS;
  const appRecent = appTime !== null && now - appTime <= PRESENCE_RECENT_MS;
  const communityRecent = communityTime !== null && now - communityTime <= PRESENCE_RECENT_MS;
  const lastActivityAt = newest(appLastSeen, communityLastSeen);
  const source: ActivitySource = appTime !== null && communityTime !== null && Math.abs(appTime - communityTime) <= 1000 ? "both" : (appTime ?? 0) >= (communityTime ?? 0) ? "app" : "community";
  if (appOnline && communityOnline) return { status: "online_both" as PresenceStatus, lastActivityAt, source: "both" as ActivitySource, appOnline, communityOnline, appRecent, communityRecent };
  if (appOnline) return { status: "online_app" as PresenceStatus, lastActivityAt, source, appOnline, communityOnline, appRecent, communityRecent };
  if (communityOnline) return { status: "online_community" as PresenceStatus, lastActivityAt, source, appOnline, communityOnline, appRecent, communityRecent };
  if (appRecent || communityRecent) return { status: "recently_active" as PresenceStatus, lastActivityAt, source, appOnline, communityOnline, appRecent, communityRecent };
  return { status: "offline" as PresenceStatus, lastActivityAt, source, appOnline, communityOnline, appRecent, communityRecent };
}
