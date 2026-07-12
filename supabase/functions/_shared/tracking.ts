export type TrackingMetadata = {
  ip_address: string | null;
  ip_header: string | null;
  ip_location: string | null;
  ip_city: string | null;
  ip_region: string | null;
  ip_country: string | null;
  ip_country_code: string | null;
  ip_timezone: string | null;
  ip_location_provider: string | null;
  ip_location_status: 'not_attempted' | 'success' | 'unavailable' | 'failed';
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
    { header: 'cf-connecting-ip', value: req.headers.get('cf-connecting-ip') },
    { header: 'x-real-ip', value: req.headers.get('x-real-ip') },
    { header: 'x-forwarded-for', value: firstHeaderValue(req.headers.get('x-forwarded-for')) },
    { header: 'x-nf-client-connection-ip', value: req.headers.get('x-nf-client-connection-ip') },
    { header: 'fastly-client-ip', value: req.headers.get('fastly-client-ip') },
    { header: 'true-client-ip', value: req.headers.get('true-client-ip') },
  ];

  for (const candidate of candidates) {
    const ip = candidate.value ? stripPort(candidate.value.trim()) : null;
    if (ip && !PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(ip))) {
      return { ip, header: candidate.header };
    }
  }

  return { ip: null, header: null };
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

type IpLocation = Pick<TrackingMetadata,
  'ip_location' |
  'ip_city' |
  'ip_region' |
  'ip_country' |
  'ip_country_code' |
  'ip_timezone' |
  'ip_location_provider' |
  'ip_location_status'
>;

const emptyLocation = (status: TrackingMetadata['ip_location_status']): IpLocation => ({
  ip_location: null,
  ip_city: null,
  ip_region: null,
  ip_country: null,
  ip_country_code: null,
  ip_timezone: null,
  ip_location_provider: null,
  ip_location_status: status,
});

export async function lookupIpLocation(ip: string | null): Promise<IpLocation> {
  if (!ip) return emptyLocation('not_attempted');

  const ipinfoToken = Deno.env.get('IPINFO_TOKEN') || '';
  const timeout = AbortSignal.timeout(3000);

  try {
    if (ipinfoToken) {
      const res = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}/json?token=${encodeURIComponent(ipinfoToken)}`, {
        signal: timeout,
      });
      if (res.ok) {
        const data = await res.json();
        const countryCode = data.country || null;
        return {
          ip_city: data.city || null,
          ip_region: data.region || null,
          ip_country: countryCode,
          ip_country_code: countryCode,
          ip_timezone: data.timezone || null,
          ip_location: [data.city, data.region, countryCode].filter(Boolean).join(', ') || null,
          ip_location_provider: 'ipinfo',
          ip_location_status: 'success',
        };
      }
    }

    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, { signal: timeout });
    if (!res.ok) return emptyLocation('unavailable');
    const data = await res.json();
    const country = data.country_name || data.country || null;
    return {
      ip_city: data.city || null,
      ip_region: data.region || null,
      ip_country: country,
      ip_country_code: data.country_code || data.country || null,
      ip_timezone: data.timezone || null,
      ip_location: [data.city, data.region, country].filter(Boolean).join(', ') || null,
      ip_location_provider: 'ipapi',
      ip_location_status: 'success',
    };
  } catch (error) {
    console.warn('IP location lookup failed', error);
    return emptyLocation('failed');
  }
}

export async function collectTrackingMetadata(req: Request): Promise<TrackingMetadata> {
  const userAgent = req.headers.get('user-agent')?.slice(0, 512) || null;
  const clientIp = getClientIp(req);
  const location = await lookupIpLocation(clientIp.ip);

  return {
    ip_address: clientIp.ip,
    ip_header: clientIp.header,
    ...location,
    browser: userAgent ? parseBrowser(userAgent) : null,
    device: userAgent ? parseDevice(userAgent) : null,
    operating_system: userAgent ? parseOperatingSystem(userAgent) : null,
    user_agent: userAgent,
  };
}
