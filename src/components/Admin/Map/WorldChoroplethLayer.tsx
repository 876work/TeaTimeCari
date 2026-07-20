import React from 'react';
import type { Layer, PathOptions } from 'leaflet';
import type { Feature, FeatureCollection } from 'geojson';
import { GeoJSON } from 'react-leaflet';

interface WorldChoroplethLayerProps {
  // Member counts keyed by ISO 3166-1 alpha-3 code, matching the feature
  // ids in public/geo/world-countries.geo.json.
  countsByIso3: Record<string, number>;
}

let worldGeoJsonPromise: Promise<FeatureCollection | null> | null = null;

function loadWorldGeoJson() {
  worldGeoJsonPromise ??= fetch('/geo/world-countries.geo.json')
    .then((res) => (res.ok ? (res.json() as Promise<FeatureCollection>) : null))
    .catch(() => null);

  return worldGeoJsonPromise;
}

// Blend the admin brand blue → purple as density rises.
function shadeFor(count: number, max: number): PathOptions {
  if (count <= 0) {
    return { fillColor: '#ffffff', fillOpacity: 0.04, color: 'rgba(255,255,255,0.25)', weight: 0.5 };
  }

  const t = Math.log(count + 1) / Math.log(max + 1);
  const from = { r: 0x4b, g: 0x9e, b: 0xc8 };
  const to = { r: 0x9b, g: 0x6b, b: 0xae };
  const r = Math.round(from.r + (to.r - from.r) * t);
  const g = Math.round(from.g + (to.g - from.g) * t);
  const b = Math.round(from.b + (to.b - from.b) * t);

  return {
    fillColor: `rgb(${r}, ${g}, ${b})`,
    fillOpacity: 0.35 + 0.45 * t,
    color: 'rgba(255,255,255,0.5)',
    weight: 0.75,
  };
}

export function WorldChoroplethLayer({ countsByIso3 }: WorldChoroplethLayerProps) {
  const [world, setWorld] = React.useState<FeatureCollection | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    loadWorldGeoJson().then((data) => {
      if (!cancelled) setWorld(data);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const max = React.useMemo(
    () => Math.max(1, ...Object.values(countsByIso3)),
    [countsByIso3],
  );

  // GeoJSON layers are immutable after mount, so remount whenever the
  // counts change (e.g. switching between registration and login views).
  const revision = React.useMemo(
    () =>
      Object.entries(countsByIso3)
        .sort()
        .map(([code, count]) => `${code}:${count}`)
        .join('|'),
    [countsByIso3],
  );

  if (!world) return null;

  const style = (feature?: Feature) => {
    const iso3 = String(feature?.id ?? '');
    return shadeFor(countsByIso3[iso3] ?? 0, max);
  };

  const onEachFeature = (feature: Feature, layer: Layer) => {
    const iso3 = String(feature.id ?? '');
    const name =
      (feature.properties as { name?: string } | null)?.name || iso3 || 'Unknown';
    const count = countsByIso3[iso3] ?? 0;

    layer.bindTooltip(`${name}: ${count} member${count === 1 ? '' : 's'}`, {
      sticky: true,
    });
  };

  return (
    <GeoJSON key={revision} data={world} style={style} onEachFeature={onEachFeature} />
  );
}
