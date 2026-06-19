import { supabase } from '@/lib/supabaseClient';

export const CREATOR_TYPES = ['ugc_creator', 'influencer', 'both'] as const;
export const TRAVEL_AVAILABILITY = ['local_only', 'national', 'regional_caribbean', 'international'] as const;
export const SERVICE_TYPES = ['event_coverage', 'ugc_content', 'influencer_campaign', 'custom'] as const;
export const CONTENT_TYPES = ['video', 'image', 'link', 'case_study', 'social_post', 'other'] as const;
export const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'x', 'website', 'other'] as const;
export const NICHES = ['lifestyle', 'food', 'travel', 'beauty', 'fashion', 'fitness', 'technology', 'parenting', 'business', 'entertainment', 'education', 'health', 'other'] as const;

export type CreatorProfile = {
  id: string;
  display_name: string | null;
  creator_type: typeof CREATOR_TYPES[number] | null;
  gender: string | null;
  country_code: string | null;
  city: string | null;
  bio: string | null;
  languages: string[];
  travel_availability: typeof TRAVEL_AVAILABILITY[number] | null;
  profile_photo_url: string | null;
  profile_completion: number;
  is_public: boolean;
  slug: string | null;
  approval_status: string;
  verification_status: string;
  average_rating: number;
  review_count: number;
  is_featured: boolean;
};

export type CreatorService = {
  id: string;
  creator_id: string;
  service_type: typeof SERVICE_TYPES[number] | null;
  service_name: string;
  description: string | null;
  deliverables: string[];
  turnaround_time: string | null;
  price_amount: number;
  currency_code: string;
  usage_rights: string | null;
  is_active: boolean;
};

type TableName = 'creator_services' | 'creator_portfolio' | 'creator_platforms' | 'creator_niches';
type RecordMap = Record<string, unknown>;
const ADMIN_FIELDS = ['approval_status', 'verification_status', 'average_rating', 'review_count', 'is_featured', 'suspended_at', 'rejection_reason'] as const;

export function validateCreatorProfile(input: Partial<CreatorProfile>) {
  if (input.display_name !== undefined && !input.display_name?.trim()) throw new Error('Display name is required.');
  if (input.creator_type !== undefined && !CREATOR_TYPES.includes(input.creator_type as never)) throw new Error('Creator type is required.');
  if (input.country_code !== undefined && !input.country_code?.trim()) throw new Error('Country is required.');
  if (input.bio && input.bio.length > 2000) throw new Error('Bio must be 2,000 characters or fewer.');
}

export function validateService(input: Partial<CreatorService>) {
  if (input.price_amount !== undefined && Number(input.price_amount) < 0) throw new Error('Price must be greater than or equal to zero.');
  if (input.currency_code !== undefined && !/^[A-Z]{3}$/.test(input.currency_code)) throw new Error('Currency code must be valid.');
}

export function validatePlatform(input: RecordMap) {
  if (input.profile_url && typeof input.profile_url === 'string') new URL(input.profile_url);
  if (Number(input.follower_count ?? 0) < 0) throw new Error('Follower count cannot be negative.');
  if (Number(input.engagement_rate ?? 0) < 0) throw new Error('Engagement rate cannot be negative.');
}

export function calculateProfileCompletion(args: {
  profile: Partial<CreatorProfile>;
  niches?: unknown[];
  platforms?: unknown[];
  portfolio?: unknown[];
  services?: { is_active?: boolean }[];
  availability?: unknown;
}) {
  let score = 0;
  if (args.profile.display_name && args.profile.creator_type && args.profile.country_code) score += 20;
  if (args.profile.profile_photo_url) score += 10;
  if ((args.profile.bio?.length ?? 0) >= 20) score += 10;
  if ((args.niches?.length ?? 0) > 0) score += 10;
  if ((args.platforms?.length ?? 0) > 0) score += 15;
  if ((args.portfolio?.length ?? 0) > 0) score += 15;
  if ((args.services?.filter((s) => s.is_active !== false).length ?? 0) > 0) score += 15;
  if (args.availability) score += 5;
  return Math.min(score, 100);
}

export async function fetchCreatorProfile() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const id = userData.user?.id;
  if (!id) throw new Error('Not authenticated.');
  const { data, error } = await supabase.from('creator_profiles').select('*').eq('id', id).single();
  if (error) throw error;
  return data as CreatorProfile;
}

export async function updateCreatorProfile(input: Partial<CreatorProfile>) {
  validateCreatorProfile(input);
  const safeInput = { ...input } as RecordMap;
  ADMIN_FIELDS.forEach((field) => delete safeInput[field]);
  const { data: userData } = await supabase.auth.getUser();
  const id = userData.user?.id;
  if (!id) throw new Error('Not authenticated.');
  const { data, error } = await supabase.from('creator_profiles').update(safeInput).eq('id', id).select('*').single();
  if (error) throw error;
  await supabase.rpc('refresh_creator_profile_completion', { target_creator_id: id });
  return data as CreatorProfile;
}

export async function listCreatorChildren(table: TableName) {
  const { data: userData } = await supabase.auth.getUser();
  const id = userData.user?.id;
  if (!id) throw new Error('Not authenticated.');
  const { data, error } = await supabase.from(table).select('*').eq('creator_id', id).order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertCreatorChild(table: TableName, input: RecordMap) {
  if (table === 'creator_services') validateService(input as Partial<CreatorService>);
  if (table === 'creator_platforms') validatePlatform(input);
  const { data: userData } = await supabase.auth.getUser();
  const creatorId = userData.user?.id;
  if (!creatorId) throw new Error('Not authenticated.');
  const payload = { ...input, creator_id: creatorId };
  const { data, error } = await supabase.from(table).upsert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteCreatorChild(table: TableName, id: string) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

export async function getCreatorAvailability() {
  const { data: userData } = await supabase.auth.getUser();
  const id = userData.user?.id;
  if (!id) throw new Error('Not authenticated.');
  const { data, error } = await supabase.from('creator_availability').select('*').eq('creator_id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertCreatorAvailability(input: RecordMap) {
  const { data: userData } = await supabase.auth.getUser();
  const creatorId = userData.user?.id;
  if (!creatorId) throw new Error('Not authenticated.');
  const { data, error } = await supabase.from('creator_availability').upsert({ ...input, creator_id: creatorId }).select('*').single();
  if (error) throw error;
  return data;
}

const publicSelect = '*, creator_services(*), creator_portfolio(*), creator_platforms(*), creator_niches(*), creator_availability(*)';

export async function fetchPublicCreatorProfile(slugOrId: string) {
  const column = /^[0-9a-f-]{36}$/i.test(slugOrId) ? 'id' : 'slug';
  const { data, error } = await supabase.from('creator_profiles').select(publicSelect).eq(column, slugOrId).single();
  if (error) throw error;
  return data;
}

export async function fetchFeaturedCreators(limit = 8) {
  const { data, error } = await supabase.from('creator_profiles').select(publicSelect).eq('is_featured', true).order('average_rating', { ascending: false }).limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchApprovedCreators() {
  const { data, error } = await supabase.from('creator_profiles').select(publicSelect).order('is_featured', { ascending: false }).order('profile_completion', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function uploadCreatorAsset(bucket: 'avatars' | 'creator-portfolios', file: File) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not authenticated.');
  const extension = file.name.split('.').pop();
  const path = `${userId}/${crypto.randomUUID()}${extension ? `.${extension}` : ''}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function adminSetCreatorStatus(creatorId: string, status: 'pending_review' | 'approved' | 'rejected' | 'suspended', reason?: string) {
  const { error } = await supabase.rpc('admin_set_creator_status', { target_creator_id: creatorId, new_approval_status: status, reason: reason ?? null });
  if (error) throw error;
}
export async function adminFeatureCreator(creatorId: string, shouldFeature: boolean) {
  const { error } = await supabase.rpc('admin_feature_creator', { target_creator_id: creatorId, should_feature: shouldFeature });
  if (error) throw error;
}
export async function adminSetCreatorVerification(creatorId: string, status: 'unverified' | 'pending' | 'verified' | 'rejected') {
  const { error } = await supabase.rpc('admin_set_creator_verification', { target_creator_id: creatorId, new_verification_status: status });
  if (error) throw error;
}
