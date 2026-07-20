import { COUNTRY_CENTROIDS } from './countryCentroids';

export interface GeoSourceRow {
  countryCode?: string | null;
  country?: string | null;
  city?: string | null;
  region?: string | null;
  status?: string | null;
  gender?: string | null;
}

export interface CountryAggregate {
  countryCode: string;
  iso3: string | null;
  name: string;
  lat: number | null;
  lng: number | null;
  total: number;
  statuses: Record<string, number>;
  genders: Record<string, number>;
  topCities: Array<{ city: string; count: number }>;
}

const CODE_ALIASES: Record<string, string> = {
  UK: 'GB',
};

let displayNames: Intl.DisplayNames | null | undefined;

function regionDisplayNames() {
  if (displayNames !== undefined) return displayNames;

  try {
    displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    displayNames = null;
  }

  return displayNames;
}

export function normalizeCountryCode(value?: string | null): string | null {
  const code = value?.trim().toUpperCase() ?? '';
  if (!/^[A-Z]{2}$/.test(code)) return null;
  return CODE_ALIASES[code] ?? code;
}

export function countryName(code: string, fallback?: string | null): string {
  try {
    const name = regionDisplayNames()?.of(code);
    if (name && name !== code) return name;
  } catch {
    // Unknown/invalid region codes throw; fall through to the fallback.
  }

  return fallback?.trim() || code;
}

export function getCountryCentroid(code: string) {
  const entry = COUNTRY_CENTROIDS[code];
  if (!entry) return null;
  return { lat: entry[0], lng: entry[1], iso3: entry[2] };
}

function increment(map: Record<string, number>, key?: string | null) {
  const normalized = key?.trim().toLowerCase();
  if (!normalized) return;
  map[normalized] = (map[normalized] ?? 0) + 1;
}

export function aggregateByCountry(rows: GeoSourceRow[]): {
  countries: CountryAggregate[];
  located: number;
  unlocated: number;
} {
  const byCode = new Map<string, CountryAggregate & { cityCounts: Record<string, number> }>();
  let located = 0;
  let unlocated = 0;

  for (const row of rows) {
    const code = normalizeCountryCode(row.countryCode);

    if (!code) {
      unlocated += 1;
      continue;
    }

    located += 1;

    let aggregate = byCode.get(code);

    if (!aggregate) {
      const centroid = getCountryCentroid(code);

      aggregate = {
        countryCode: code,
        iso3: centroid?.iso3 ?? null,
        name: countryName(code, row.country),
        lat: centroid?.lat ?? null,
        lng: centroid?.lng ?? null,
        total: 0,
        statuses: {},
        genders: {},
        topCities: [],
        cityCounts: {},
      };

      byCode.set(code, aggregate);
    }

    aggregate.total += 1;
    increment(aggregate.statuses, row.status);
    increment(aggregate.genders, row.gender);
    increment(aggregate.cityCounts, row.city);
  }

  const countries = [...byCode.values()]
    .map(({ cityCounts, ...aggregate }) => ({
      ...aggregate,
      topCities: Object.entries(cityCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([city, count]) => ({
          city: city.replace(/\b\w/g, (letter) => letter.toUpperCase()),
          count,
        })),
    }))
    .sort((a, b) => b.total - a.total);

  return { countries, located, unlocated };
}

export function countsByIso3(countries: CountryAggregate[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const country of countries) {
    if (country.iso3) counts[country.iso3] = country.total;
  }

  return counts;
}
