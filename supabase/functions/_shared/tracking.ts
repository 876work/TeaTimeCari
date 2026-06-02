export type TrackingMetadata = {
  ip_address: string | null;
  ip_location: string | null;
  browser: string | null;
  device: string | null;
  operating_system: string | null;
  user_agent: string | null;
};

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^::1$/,
  /^fc/i,
  /^fd/i,
  /^localhost$/i,
];

function firstHeaderValue(value: string | null) {
  return value?.split(',')[0]?.trim() || null;
}

function stripPort(ip: string) {
  if (ip.startsWith('[')) return ip.slice(1, ip.indexOf(']'));
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) return ip.split(':')[0];
  return ip;
}

export function getClientIp(req: Request) {
  const candidates = [
    req.headers.get('cf-connecting-ip'),
    req.headers.get('x-real-ip'),
    firstHeaderValue(req.headers.get('x-forwarded-for')),
    req.headers.get('x-nf-client-connection-ip'),
    req.headers.get('fastly-client-ip'),
    req.headers.get('true-client-ip'),
  ];

  const ip = candidates.map((candidate) => candidate ? stripPort(candidate.trim()) : null).find(Boolean) || null;
  if (!ip || PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(ip))) return null;
  return ip;
}

function parseBrowser(userAgent: string) {
  if (/Edg\//.test(userAgent)) return 'Microsoft Edge';
  if (/OPR\//.test(userAgent) || /Opera/.test(userAgent)) return 'Opera';
  if (/Chrome\//.test(userAgent) && !/Chromium\//.test(userAgent)) return 'Chrome';
  if (/Firefox\//.test(userAgent)) return 'Firefox';
  if (/Safari\//.test(userAgent) && /Version\//.test(userAgent)) return 'Safari';
  if (/SamsungBrowser\//.test(userAgent)) return 'Samsung Internet';
  return userAgent ? 'Unknown browser' : null;
}

function parseOperatingSystem(userAgent: string) {
  if (/Windows NT/.test(userAgent)) return 'Windows';
  if (/Android/.test(userAgent)) return 'Android';
  if (/(iPhone|iPad|iPod)/.test(userAgent)) return 'iOS';
  if (/Mac OS X/.test(userAgent)) return 'macOS';
  if (/Linux/.test(userAgent)) return 'Linux';
  if (/CrOS/.test(userAgent)) return 'ChromeOS';
  return userAgent ? 'Unknown OS' : null;
}

function parseDevice(userAgent: string) {
  if (/iPad|Tablet|Silk/.test(userAgent)) return 'Tablet';
  if (/Mobi|Android|iPhone|iPod/.test(userAgent)) return 'Mobile';
  if (userAgent) return 'Desktop';
  return null;
}

async function lookupIpLocation(ip: string | null) {
  if (!ip) return null;

  const ipinfoToken = Deno.env.get('IPINFO_TOKEN') || '';
  const timeout = AbortSignal.timeout(1500);

  try {
    if (ipinfoToken) {
      const res = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}/json?token=${encodeURIComponent(ipinfoToken)}`, {
        signal: timeout,
      });
      if (res.ok) {
        const data = await res.json();
        return [data.city, data.region, data.country].filter(Boolean).join(', ') || null;
      }
    }

    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, { signal: timeout });
    if (!res.ok) return null;
    const data = await res.json();
    return [data.city, data.region, data.country_name || data.country].filter(Boolean).join(', ') || null;
  } catch (error) {
    console.warn('IP location lookup failed', error);
    return null;
  }
}

export async function collectTrackingMetadata(req: Request): Promise<TrackingMetadata> {
  const userAgent = req.headers.get('user-agent')?.slice(0, 512) || null;
  const ip = getClientIp(req);

  return {
    ip_address: ip,
    ip_location: await lookupIpLocation(ip),
    browser: userAgent ? parseBrowser(userAgent) : null,
    device: userAgent ? parseDevice(userAgent) : null,
    operating_system: userAgent ? parseOperatingSystem(userAgent) : null,
    user_agent: userAgent,
  };
}
