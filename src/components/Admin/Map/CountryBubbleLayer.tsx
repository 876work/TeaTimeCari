import { CircleMarker, Popup } from 'react-leaflet';
import type { CountryAggregate } from '@/lib/geo';

interface CountryBubbleLayerProps {
  countries: CountryAggregate[];
}

function labelize(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function BreakdownRow({ label, counts }: { label: string; counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;

  return (
    <p className="mt-1 text-xs text-slate-600">
      <span className="font-semibold text-slate-700">{label}:</span>{' '}
      {entries.map(([key, count]) => `${labelize(key)} ${count}`).join(' · ')}
    </p>
  );
}

export function CountryBubbleLayer({ countries }: CountryBubbleLayerProps) {
  const max = Math.max(1, ...countries.map((country) => country.total));

  return (
    <>
      {countries.map((country) => {
        if (country.lat === null || country.lng === null) return null;

        const t = Math.sqrt(country.total / max);

        return (
          <CircleMarker
            key={country.countryCode}
            center={[country.lat, country.lng]}
            radius={6 + 14 * t}
            pathOptions={{
              color: '#ffffff',
              weight: 1.5,
              fillColor: '#D96E6E',
              fillOpacity: 0.8,
            }}
          >
            <Popup>
              <div className="min-w-[10rem]">
                <p className="text-sm font-bold text-slate-800">{country.name}</p>
                <p className="text-xs text-slate-600">
                  {country.total} member{country.total === 1 ? '' : 's'}
                </p>
                <BreakdownRow label="Status" counts={country.statuses} />
                <BreakdownRow label="Gender" counts={country.genders} />
                {country.topCities.length > 0 && (
                  <p className="mt-1 text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">Top cities:</span>{' '}
                    {country.topCities
                      .map(({ city, count }) => `${city} (${count})`)
                      .join(' · ')}
                  </p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
