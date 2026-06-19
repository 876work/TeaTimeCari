import React from 'react';
import { useParams } from 'react-router-dom';
import { usePublicCreatorProfile } from '@/hooks/creatorflow/useCreatorProfiles';

type PublicCreator = {
  display_name?: string | null;
  creator_type?: string | null;
  city?: string | null;
  country_code?: string | null;
  bio?: string | null;
  profile_photo_url?: string | null;
  average_rating?: number;
  review_count?: number;
  creator_services?: Array<{ id: string; service_name?: string; title?: string; price_amount?: number; currency_code?: string; description?: string | null }>;
  creator_portfolio?: Array<{ id: string; title: string; thumbnail_url?: string | null; external_url?: string | null }>;
  creator_platforms?: Array<{ id: string; platform: string; username?: string | null; profile_url?: string | null; follower_count?: number }>;
  creator_niches?: Array<{ id: string; niche: string }>;
};

export default function CreatorProfilePage() {
  const { slug = '' } = useParams();
  const { data, loading, error, isEmpty } = usePublicCreatorProfile(slug);
  const creator = data as PublicCreator | null;

  if (loading) return <main className="mx-auto max-w-5xl px-6 py-16"><p>Loading creator profile…</p></main>;
  if (error || isEmpty || !creator) return <main className="mx-auto max-w-5xl px-6 py-16"><h1 className="text-2xl font-bold">Creator not available</h1><p className="mt-2 text-gray-600">This profile may be private, unapproved, suspended, or no longer available.</p></main>;

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <section className="rounded-3xl bg-white p-8 shadow-lg">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          {creator.profile_photo_url ? <img src={creator.profile_photo_url} alt="" className="h-32 w-32 rounded-full object-cover" /> : <div className="h-32 w-32 rounded-full bg-purple-100" />}
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-purple-600">{creator.creator_type?.replace('_', ' ')}</p>
            <h1 className="text-4xl font-bold text-gray-950">{creator.display_name}</h1>
            <p className="mt-2 text-gray-600">{[creator.city, creator.country_code].filter(Boolean).join(', ')}</p>
            <p className="mt-2 text-sm text-gray-500">Rating {creator.average_rating ?? 0} ({creator.review_count ?? 0} reviews)</p>
          </div>
        </div>
        {creator.bio && <p className="mt-8 whitespace-pre-line text-gray-700">{creator.bio}</p>}
      </section>

      <section className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold">Services</h2>
          {creator.creator_services?.length ? creator.creator_services.map((service) => <article key={service.id} className="mt-4 border-t pt-4"><h3 className="font-semibold">{service.service_name ?? service.title}</h3><p className="text-sm text-gray-600">{service.description}</p><p className="mt-2 font-medium">{service.currency_code} {service.price_amount}</p></article>) : <p className="mt-4 text-gray-500">No public services yet.</p>}
        </div>
        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold">Niches & platforms</h2>
          <div className="mt-4 flex flex-wrap gap-2">{creator.creator_niches?.map((niche) => <span key={niche.id} className="rounded-full bg-purple-50 px-3 py-1 text-sm text-purple-700">{niche.niche}</span>)}</div>
          <div className="mt-4 space-y-2">{creator.creator_platforms?.map((platform) => <a key={platform.id} href={platform.profile_url ?? undefined} className="block text-sm text-purple-700">{platform.platform}: {platform.username ?? platform.follower_count}</a>)}</div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl bg-white p-6 shadow">
        <h2 className="text-xl font-semibold">Portfolio</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3">{creator.creator_portfolio?.map((item) => <a key={item.id} href={item.external_url ?? '#'} className="rounded-xl border p-4"><div className="aspect-video rounded-lg bg-gray-100">{item.thumbnail_url && <img src={item.thumbnail_url} alt="" className="h-full w-full rounded-lg object-cover" />}</div><h3 className="mt-3 font-medium">{item.title}</h3></a>)}</div>
      </section>
    </main>
  );
}
