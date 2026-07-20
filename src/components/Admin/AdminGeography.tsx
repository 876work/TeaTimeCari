import { useEffect, useMemo, useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Globe2, MapPin, RefreshCw, Users } from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { AdminMap } from './Map/AdminMap';
import { WorldChoroplethLayer } from './Map/WorldChoroplethLayer';
import { CountryBubbleLayer } from './Map/CountryBubbleLayer';
import { getFunctionErrorMessage } from '@/lib/functionError';
import { aggregateByCountry, countsByIso3, type GeoSourceRow } from '@/lib/geo';
import {
  AdminAlert,
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminEmptyState,
  AdminMetricCard,
  AdminPageHeader,
  AdminSkeleton,
} from './ui';

interface GeoUserRow {
  id: string;
  status?: string | null;
  gender?: string | null;
  registration_country_code?: string | null;
  registration_country?: string | null;
  registration_city?: string | null;
  last_login_country_code?: string | null;
  last_login_country?: string | null;
  last_login_city?: string | null;
}

type LocationSource = 'registration' | 'login';

const PAGE_SIZE = 500;
const MAX_USERS = 2000;

function toGeoRows(users: GeoUserRow[], source: LocationSource): GeoSourceRow[] {
  return users.map((user) => ({
    countryCode: source === 'registration' ? user.registration_country_code : user.last_login_country_code,
    country: source === 'registration' ? user.registration_country : user.last_login_country,
    city: source === 'registration' ? user.registration_city : user.last_login_city,
    status: user.status,
    gender: user.gender,
  }));
}

export function AdminGeography({
  activePage = 'geography',
  onNavigate,
}: {
  activePage?: string;
  onNavigate?: (page: string) => void;
}) {
  const supabase = useSupabaseClient();

  const [users, setUsers] = useState<GeoUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<LocationSource>('registration');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) throw new Error('You must be logged in as an admin.');

      const collected: GeoUserRow[] = [];
      let total = Infinity;

      while (collected.length < Math.min(total, MAX_USERS)) {
        const { data, error: fnError } = await supabase.functions.invoke('get-admin-users', {
          body: { limit: PAGE_SIZE, offset: collected.length },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (fnError) throw new Error(await getFunctionErrorMessage(fnError));
        if (!data?.ok) throw new Error(data?.error || 'Unable to load users.');

        const page = (data.users ?? []) as GeoUserRow[];
        collected.push(...page);
        total = typeof data.total === 'number' ? data.total : collected.length;

        if (page.length < PAGE_SIZE) break;
      }

      setUsers(collected);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { countries, located, unlocated } = useMemo(
    () => aggregateByCountry(toGeoRows(users, source)),
    [users, source],
  );

  const iso3Counts = useMemo(() => countsByIso3(countries), [countries]);
  const topCountry = countries[0] ?? null;

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className="space-y-6">
        <AdminPageHeader
          title="Geography"
          description="Where the community registers and signs in, aggregated to country level from IP-based location tracking. No precise member locations are shown or stored."
          meta={lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : null}
          actions={
            <AdminButton variant="glass" onClick={fetchUsers} loading={loading}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </AdminButton>
          }
        />

        {error && (
          <AdminAlert variant="error">
            <p>Could not load geography data</p>
            <p>{error}</p>
          </AdminAlert>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminMetricCard
            title="Located members"
            value={located.toLocaleString()}
            description={source === 'registration' ? 'With registration location' : 'With last-login location'}
            icon={<MapPin className="h-5 w-5" />}
            accent="brand"
            loading={loading}
          />
          <AdminMetricCard
            title="Countries"
            value={countries.length.toLocaleString()}
            description="Distinct countries detected"
            icon={<Globe2 className="h-5 w-5" />}
            accent="info"
            loading={loading}
          />
          <AdminMetricCard
            title="Top country"
            value={topCountry ? topCountry.name : '—'}
            description={topCountry ? `${topCountry.total.toLocaleString()} members` : 'No location data yet'}
            icon={<Users className="h-5 w-5" />}
            accent="success"
            loading={loading}
          />
          <AdminMetricCard
            title="No location data"
            value={unlocated.toLocaleString()}
            description="Lookup unavailable or not attempted"
            icon={<MapPin className="h-5 w-5" />}
            accent="muted"
            loading={loading}
          />
        </div>

        <AdminCard
          title="Member map"
          description="Countries shade darker with more members; bubbles size with member counts. Click a bubble for the status, gender, and city breakdown."
          actions={
            <div className="flex items-center gap-2">
              <AdminButton
                size="sm"
                variant={source === 'registration' ? 'primary' : 'glass'}
                onClick={() => setSource('registration')}
              >
                Registration
              </AdminButton>
              <AdminButton
                size="sm"
                variant={source === 'login' ? 'primary' : 'glass'}
                onClick={() => setSource('login')}
              >
                Last login
              </AdminButton>
            </div>
          }
        >
          {loading ? (
            <AdminSkeleton className="h-[28rem] w-full rounded-2xl" />
          ) : (
            <AdminMap>
              <WorldChoroplethLayer countsByIso3={iso3Counts} />
              <CountryBubbleLayer countries={countries} />
            </AdminMap>
          )}
        </AdminCard>

        <AdminCard
          title="Country ranking"
          description={`Members by ${source === 'registration' ? 'registration' : 'last-login'} country`}
          actions={<AdminBadge>{located.toLocaleString()} located</AdminBadge>}
        >
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }, (_, index) => (
                <AdminSkeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : countries.length === 0 ? (
            <AdminEmptyState
              icon={<Globe2 className="h-8 w-8" />}
              title="No location data yet"
              message="Locations appear here once IP lookups succeed for registrations or logins. Run the location backfill if older rows are missing data."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/15 text-xs uppercase tracking-wide text-white/60">
                    <th className="px-3 py-2 font-semibold">Country</th>
                    <th className="px-3 py-2 font-semibold">Members</th>
                    <th className="px-3 py-2 font-semibold">Share</th>
                    <th className="hidden px-3 py-2 font-semibold sm:table-cell">Approved</th>
                    <th className="hidden px-3 py-2 font-semibold sm:table-cell">Pending</th>
                    <th className="hidden px-3 py-2 font-semibold lg:table-cell">Top city</th>
                  </tr>
                </thead>
                <tbody>
                  {countries.map((country) => {
                    const share = located > 0 ? (country.total / located) * 100 : 0;

                    return (
                      <tr key={country.countryCode} className="border-b border-white/10 last:border-0">
                        <td className="px-3 py-2.5 font-semibold text-white">
                          {country.name}
                          <span className="ml-2 text-xs font-normal text-white/50">{country.countryCode}</span>
                        </td>
                        <td className="px-3 py-2.5 text-white/90">{country.total.toLocaleString()}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[#4B9EC8] to-[#9B6BAE]"
                                style={{ width: `${Math.max(share, 2)}%` }}
                              />
                            </div>
                            <span className="text-xs text-white/70">{share.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="hidden px-3 py-2.5 text-white/80 sm:table-cell">
                          {country.statuses.approved ?? 0}
                        </td>
                        <td className="hidden px-3 py-2.5 text-white/80 sm:table-cell">
                          {country.statuses.pending ?? 0}
                        </td>
                        <td className="hidden px-3 py-2.5 text-white/70 lg:table-cell">
                          {country.topCities[0]
                            ? `${country.topCities[0].city} (${country.topCities[0].count})`
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </AdminCard>
      </div>
    </AdminLayout>
  );
}
