import React from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getAdDevice, getAdSessionId, getAdsShownThisSession, markAdShown } from '@/lib/adSession';
import { debugError } from '@/lib/debugLogger';

export type AdPlacement = 'homepage' | 'in_feed' | 'footer';

interface AdRow {
  id: string;
  title: string;
  advertiser_name: string | null;
  image_path: string;
  image_width: number | null;
  image_height: number | null;
  destination_url: string;
  alt_text: string | null;
  placement: AdPlacement;
  device_target: 'all' | 'desktop' | 'mobile';
  priority: number;
}

const placementCache = new Map<AdPlacement, Promise<AdRow[]>>();

function fetchAdsForPlacement(placement: AdPlacement): Promise<AdRow[]> {
  if (!placementCache.has(placement)) {
    const request = Promise.resolve(
      supabase
        .from('advertisements')
        .select(
          'id, title, advertiser_name, image_path, image_width, image_height, destination_url, alt_text, placement, device_target, priority',
        )
        .eq('placement', placement)
        .order('priority', { ascending: false }),
    ).then(({ data, error }) => {
      if (error) {
        debugError('Failed to load ads for placement', placement, error);
        placementCache.delete(placement);
        return [] as AdRow[];
      }
      return (data ?? []) as AdRow[];
    });

    placementCache.set(placement, request);
  }

  return placementCache.get(placement)!;
}

function pickWeighted(ads: AdRow[]): AdRow | null {
  if (ads.length === 0) return null;

  const weights = ads.map((ad) => Math.max(ad.priority, 0) + 1);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * total;

  for (let index = 0; index < ads.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return ads[index];
  }

  return ads[ads.length - 1];
}

export function AdSlot({ placement, className = '' }: { placement: AdPlacement; className?: string }) {
  const [ad, setAd] = React.useState<AdRow | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const impressionSentRef = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;

    fetchAdsForPlacement(placement).then((ads) => {
      if (cancelled) return;

      const device = getAdDevice();
      const eligible = ads.filter((row) => row.device_target === 'all' || row.device_target === device);
      const shown = getAdsShownThisSession(placement);
      const notShown = eligible.filter((row) => !shown.has(row.id));
      const pool = notShown.length > 0 ? notShown : eligible;
      const picked = pickWeighted(pool);

      if (picked) markAdShown(placement, picked.id);
      setAd(picked);
    });

    return () => {
      cancelled = true;
    };
  }, [placement]);

  React.useEffect(() => {
    if (!ad || impressionSentRef.current) return;
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    let visibleSince: number | null = null;
    let timer: number | null = null;

    const recordImpression = () => {
      if (impressionSentRef.current) return;
      impressionSentRef.current = true;

      void supabase.functions
        .invoke('ad-impression', {
          body: {
            ad_id: ad.id,
            placement,
            session_id: getAdSessionId(),
            device: getAdDevice(),
          },
        })
        .catch(() => {
          // Impression tracking is best-effort; never surface this to the user.
        });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (visibleSince === null) {
            visibleSince = Date.now();
            timer = window.setTimeout(recordImpression, 1000);
          }
        } else {
          visibleSince = null;
          if (timer !== null) {
            window.clearTimeout(timer);
            timer = null;
          }
        }
      },
      { threshold: [0, 0.5, 1] },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [ad, placement]);

  if (!ad) return null;

  const imageUrl = supabase.storage.from('ad-creatives').getPublicUrl(ad.image_path).data.publicUrl;

  const handleClick = () => {
    void supabase.functions
      .invoke('ad-click', {
        body: {
          ad_id: ad.id,
          placement,
          session_id: getAdSessionId(),
          device: getAdDevice(),
        },
      })
      .catch(() => {
        // Click tracking is best-effort; never block the navigation.
      });
  };

  return (
    <div
      ref={containerRef}
      className={`relative mx-auto w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl ${className}`}
    >
      <span className="absolute left-3 top-3 z-10 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
        Sponsored
      </span>

      <a
        href={ad.destination_url}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={handleClick}
        aria-label={ad.advertiser_name ? `${ad.title} — ${ad.advertiser_name}` : ad.title}
        className="block aspect-[320/100] w-full sm:aspect-[728/90]"
      >
        <img
          src={imageUrl}
          alt={ad.alt_text || ad.title}
          className="h-full w-full object-contain"
          loading="lazy"
        />
      </a>
    </div>
  );
}
