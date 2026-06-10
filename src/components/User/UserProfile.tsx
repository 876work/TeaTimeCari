import React, { useState, useEffect } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { 
  User, 
  Calendar, 
  MessageSquare, 
  Image as ImageIcon, 
  CheckCircle, 
  XCircle, 
  ArrowLeft, 
  Shield, 
  ShieldOff,
  Loader2, 
  AlertCircle,
  Eye,
  X,
  Flag,
  Users,
  Camera,
  Lock,
  Mail,
  KeyRound,
  Sparkles
} from 'lucide-react';
import { isValidUUID } from '../../utils/validationUtils';
import { isApprovedRegistrationStatus } from '@/lib/auth/approvalStatus';

// Type definitions
interface UserProfileData {
  id: string;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  username: string;
  gender: 'Male' | 'Female';
  status: string;
  created_at: string;
}

interface UserPost {
  id: string;
  photo_url: string;
  green_flag_count: number;
  red_flag_count: number;
  created_at: string;
}

interface UserComment {
  id: string;
  content: string;
  created_at: string;
  post_id: string;
  post?: {
    photo_url: string;
    username: string;
  };
}

interface UserStats {
  totalPosts: number;
  totalComments: number;
  totalGreenFlags: number;
  totalRedFlags: number;
}


type VisibilityAudience = 'only-you' | 'admins' | 'community';

interface VisibilityIndicatorProps {
  audience: VisibilityAudience;
  isOwnProfile?: boolean;
  className?: string;
}

const visibilityStyles: Record<VisibilityAudience, string> = {
  'only-you': 'border-slate-200 bg-slate-50 text-slate-700',
  admins: 'border-amber-200 bg-amber-50 text-amber-800',
  community: 'border-emerald-200 bg-emerald-50 text-emerald-800'
};

const visibilityIcons = {
  'only-you': Lock,
  admins: Shield,
  community: Users
};

function getVisibilityLabel(audience: VisibilityAudience, isOwnProfile = true): string {
  if (audience === 'only-you') return isOwnProfile ? 'Visible to: only you' : 'Visible to: this member only';
  if (audience === 'admins') return isOwnProfile ? 'Visible to: you + admins' : 'Visible to: this member + admins';
  return 'Visible to: community';
}

function VisibilityIndicator({ audience, isOwnProfile = true, className = '' }: VisibilityIndicatorProps) {
  const Icon = visibilityIcons[audience];

  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${visibilityStyles[audience]} ${className}`}>
      <Icon className="mr-1.5 h-3.5 w-3.5" />
      {getVisibilityLabel(audience, isOwnProfile)}
    </span>
  );
}

interface UserProfileProps {
  userId: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function canViewProfiles(status?: string | null): boolean {
  return isApprovedRegistrationStatus(status);
}

export function UserProfile({ userId }: UserProfileProps) {
  const supabase = useSupabaseClient();
  const session = useSession();

  const goBackToFeed = () => {
    window.history.back();
  };

  const [currentUser, setCurrentUser] = useState<UserProfileData | null>(null);
  const [profileUser, setProfileUser] = useState<UserProfileData | null>(null);
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [userComments, setUserComments] = useState<UserComment[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({
    totalPosts: 0,
    totalComments: 0,
    totalGreenFlags: 0,
    totalRedFlags: 0
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [processingBan, setProcessingBan] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [reauthCode, setReauthCode] = useState('');
  const [reauthEmailSent, setReauthEmailSent] = useState(false);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityMessage, setSecurityMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const setMockData = (profileData?: UserProfileData) => {
    if (!profileData) {
      const mockProfileUser: UserProfileData = {
        id: userId,
        fullName: 'Demo User',
        username: 'demo_user',
        gender: 'Male',
        status: 'approved',
        created_at: new Date().toISOString()
      };
      setProfileUser(mockProfileUser);
      profileData = mockProfileUser;
    }

    const mockPosts: UserPost[] = [
      {
        id: '1',
        photo_url: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=400',
        green_flag_count: 12,
        red_flag_count: 3,
        created_at: new Date().toISOString()
      },
      {
        id: '2',
        photo_url: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=400',
        green_flag_count: 8,
        red_flag_count: 1,
        created_at: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: '3',
        photo_url: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=400',
        green_flag_count: 15,
        red_flag_count: 2,
        created_at: new Date(Date.now() - 172800000).toISOString()
      }
    ];

    const mockComments: UserComment[] = [
      {
        id: '1',
        content: 'Great photo! Love the composition and lighting.',
        created_at: new Date().toISOString(),
        post_id: 'post-1',
        post: {
          photo_url: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=200',
          username: 'other_user'
        }
      },
      {
        id: '2',
        content: 'This is really inspiring! Thanks for sharing.',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        post_id: 'post-2',
        post: {
          photo_url: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=200',
          username: 'another_user'
        }
      }
    ];

    setUserPosts(mockPosts);
    setUserComments(mockComments);
    setUserStats({
      totalPosts: mockPosts.length,
      totalComments: mockComments.length,
      totalGreenFlags: mockPosts.reduce((sum, post) => sum + post.green_flag_count, 0),
      totalRedFlags: mockPosts.reduce((sum, post) => sum + post.red_flag_count, 0)
    });
  };

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      setError(null);

      let profileDataForFallback: UserProfileData | null = null;

      try {
        if (!session?.user?.id) {
          setError('Please log in to view profiles.');
          return;
        }

        if (!userId) {
          setError('No user ID provided.');
          return;
        }

        if (!isValidUUID(userId)) {
          setError('The provided user ID is not valid. Please check the URL and try again.');
          return;
        }

        const { data: userData, error: userError } = await supabase
          .from('registrations')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (userError) {
          console.error('Error fetching current user:', userError);
          setError('Failed to load user data. Please try again.');
          return;
        }

        if (!userData) {
          setError('User registration not found. Please complete registration first.');
          return;
        }

        if (!canViewProfiles(userData.status)) {
          setError('Access denied. Your account must be approved to view profiles.');
          return;
        }

        setCurrentUser(userData);

        const userIsAdmin = session?.user?.email?.includes('admin') || false;
        setIsAdmin(userIsAdmin);

        if (userId !== session.user.id && !userIsAdmin) {
          setError('Access denied. You can only view your own profile.');
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from('registrations')
          .select('id, firstName, lastName, username, gender, status, created_at')
          .eq('id', userId)
          .maybeSingle();

        if (profileError) {
          console.error('Error fetching profile user:', profileError);
          if (profileError.code === 'PGRST116') {
            setError('User not found.');
          } else {
            setError('Failed to load profile data.');
          }
          return;
        }

        if (!profileData) {
          setError('User not found.');
          return;
        }

        const fullName = [profileData.firstName, profileData.lastName]
          .filter(Boolean)
          .join(' ')
          .trim() || profileData.username || 'User';

        profileDataForFallback = { ...profileData, fullName };
        setProfileUser(profileDataForFallback);

        const { data: postsData, error: postsError } = await supabase
          .from('posts')
          .select('id, photo_url, green_flag_count, red_flag_count, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (postsError && postsError.code !== '42P01') {
          throw postsError;
        }

        const posts = postsData || [];
        setUserPosts(posts);

        const { data: commentsData, error: commentsError } = await supabase
          .from('comments')
          .select(`
            id,
            content,
            created_at,
            post_id,
            posts!inner(photo_url, username)
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        let comments: UserComment[] = [];

        if (commentsError && commentsError.code !== '42P01') {
          console.error('Error fetching comments:', commentsError);
          setUserComments([]);
        } else {
          comments = (commentsData || []).map(comment => {
            const post = Array.isArray(comment.posts) ? comment.posts[0] : comment.posts;
            return {
              ...comment,
              post
            };
          });
          setUserComments(comments);
        }

        const totalGreenFlags = posts.reduce((sum, post) => sum + post.green_flag_count, 0);
        const totalRedFlags = posts.reduce((sum, post) => sum + post.red_flag_count, 0);
        const totalComments = comments.length;

        setUserStats({
          totalPosts: posts.length,
          totalComments,
          totalGreenFlags,
          totalRedFlags
        });

        if (posts.length === 0 && totalComments === 0) {
          setMockData(profileDataForFallback);
        }
      } catch (err: unknown) {
        console.error('Error fetching user data:', err);
        setError(`Failed to load user data: ${getErrorMessage(err)}`);

        if (profileDataForFallback) {
          setMockData(profileDataForFallback);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();

    // Existing mock data fallback is intentionally kept out of the dependency list to avoid refetch loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, userId, supabase]);

  const handleToggleBan = async () => {
    if (!profileUser || !isAdmin || processingBan) return;

    const isBanned = profileUser.status === 'banned';
    const action = isBanned ? 'unban' : 'ban';
    const confirmMessage = `Are you sure you want to ${action} @${profileUser.username}?`;

    if (!confirm(confirmMessage)) return;

    setProcessingBan(true);
    setError(null);

    try {
      const newStatus = isBanned ? 'approved' : 'banned';

      const { error: updateError } = await supabase
        .from('registrations')
        .update({ status: newStatus })
        .eq('id', userId);

      if (updateError && updateError.code !== '42P01') {
        throw updateError;
      }

      setProfileUser(prev => prev ? { ...prev, status: newStatus } : null);

      try {
        await supabase
          .from('moderation_logs')
          .insert([{
            admin_id: session?.user?.id,
            action: `${action}_user`,
            target_user_id: userId,
            reason: `User ${action}ned via profile page`,
            created_at: new Date().toISOString()
          }]);
      } catch (logError) {
        console.warn('Failed to log moderation action:', logError);
      }

      alert(`User @${profileUser.username} has been ${action}ned successfully.`);
    } catch (err: unknown) {
      console.error(`Error ${action}ning user:`, err);
      setError(`Failed to ${action} user: ${getErrorMessage(err)}`);
    } finally {
      setProcessingBan(false);
    }
  };

  const resetPasswordForm = () => {
    setNewPassword('');
    setConfirmPassword('');
    setReauthCode('');
    setReauthEmailSent(false);
  };

  const handleSendReauthCode = async () => {
    if (!session?.user?.email) {
      setSecurityMessage({ ok: false, text: 'Please sign in again before changing your password.' });
      return;
    }

    setSecurityLoading(true);
    setSecurityMessage(null);

    const { error: reauthError } = await supabase.auth.reauthenticate();

    setSecurityLoading(false);

    if (reauthError) {
      setSecurityMessage({ ok: false, text: reauthError.message });
      return;
    }

    setReauthEmailSent(true);
    setSecurityMessage({
      ok: true,
      text: `We sent a verification code to ${session.user.email}. Enter it below to finish updating your password.`,
    });
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setSecurityMessage(null);

    if (newPassword.length < 10) {
      setSecurityMessage({ ok: false, text: 'Your new password must be at least 10 characters long.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setSecurityMessage({ ok: false, text: 'The new passwords do not match.' });
      return;
    }

    if (!reauthCode.trim()) {
      setSecurityMessage({ ok: false, text: 'Enter the verification code from your reauthentication email.' });
      return;
    }

    setSecurityLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
      nonce: reauthCode.trim(),
    });

    setSecurityLoading(false);

    if (updateError) {
      setSecurityMessage({ ok: false, text: updateError.message });
      return;
    }

    resetPasswordForm();
    setSecurityMessage({ ok: true, text: 'Your password has been updated successfully.' });
  };

  const openImageModal = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setIsImageModalOpen(true);
  };

  const closeImageModal = () => {
    setSelectedImage(null);
    setIsImageModalOpen(false);
  };

  if (!userId || !isValidUUID(userId)) {
    return (
      <div className="p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-600 mb-4">Invalid User ID</h2>
            <p className="text-gray-700 mb-6">
              The provided user ID is not valid. Please check the URL and try again.
            </p>
            <button
              onClick={goBackToFeed}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-600 mb-4">Profile Not Found</h2>
            <p className="text-gray-700 mb-6">{error || 'Profile data could not be loaded.'}</p>
            <button
              onClick={goBackToFeed}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === profileUser.id;
  const isBanned = profileUser.status === 'banned';

  return (
    <div className="p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <button
          onClick={goBackToFeed}
          className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Feed
        </button>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center mb-4 sm:mb-0">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mr-4 ${
                isBanned
                  ? 'bg-red-100'
                  : profileUser.gender === 'Male'
                    ? 'bg-blue-100'
                    : 'bg-pink-100'
              }`}>
                <User className={`w-8 h-8 ${
                  isBanned
                    ? 'text-red-600'
                    : profileUser.gender === 'Male'
                      ? 'text-blue-600'
                      : 'text-pink-600'
                }`} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {profileUser.fullName}
                  </h1>
                  <VisibilityIndicator audience="admins" isOwnProfile={isOwnProfile} />
                  {isBanned && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      <ShieldOff className="w-3 h-3 mr-1" />
                      Banned
                    </span>
                  )}
                  {isOwnProfile && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      You
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-gray-600">
                  <span>@{profileUser.username}</span>
                  <VisibilityIndicator audience="community" isOwnProfile={isOwnProfile} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                  <span className="inline-flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    {profileUser.gender}
                  </span>
                  <VisibilityIndicator audience="community" isOwnProfile={isOwnProfile} />
                  <span className="inline-flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    Joined {new Date(profileUser.created_at).toLocaleDateString()}
                  </span>
                  <VisibilityIndicator audience="community" isOwnProfile={isOwnProfile} />
                </div>
              </div>
            </div>

            {isAdmin && !isOwnProfile && (
              <button
                onClick={handleToggleBan}
                disabled={processingBan}
                className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                  isBanned
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                } ${processingBan ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {processingBan ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : isBanned ? (
                  <Shield className="w-4 h-4 mr-2" />
                ) : (
                  <ShieldOff className="w-4 h-4 mr-2" />
                )}
                {isBanned ? 'Unban User' : 'Ban User'}
              </button>
            )}
          </div>
        </div>

        {error && profileUser && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4" role="alert">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="flex items-center text-lg font-semibold text-gray-900">
                  <Lock className="mr-2 h-5 w-5 text-slate-500" />
                  Profile privacy at a glance
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
                  Public profile pages are intentionally limited. Non-admin community members cannot open another member's full profile page in this app; community visibility means the field may still appear in shared community surfaces such as posts, comments, or member context.
                </p>
              </div>
              <VisibilityIndicator audience="only-you" isOwnProfile={isOwnProfile} />
            </div>
          </div>
          <div className="grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Full name</p>
              <div className="mt-2">
                <VisibilityIndicator audience="admins" isOwnProfile={isOwnProfile} />
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">Used for account review and moderation, not community display.</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Username</p>
              <div className="mt-2">
                <VisibilityIndicator audience="community" isOwnProfile={isOwnProfile} />
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">Your community-facing identity.</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gender</p>
              <div className="mt-2">
                <VisibilityIndicator audience="community" isOwnProfile={isOwnProfile} />
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">Used to place members in appropriate community spaces.</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Joined date</p>
              <div className="mt-2">
                <VisibilityIndicator audience="community" isOwnProfile={isOwnProfile} />
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">Shows account tenure without exposing contact details.</p>
            </div>
          </div>
        </div>

        {isOwnProfile && (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-blue-900/10">
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-[#4B9EC8] px-6 py-6 text-white">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="mb-2 inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-50">
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    Private account tools
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-bold">Security settings</h2>
                    <VisibilityIndicator audience="only-you" />
                  </div>
                  <p className="mt-2 max-w-2xl text-sm text-blue-50/90">
                    Change your password with Supabase reauthentication. We email you a one-time code first so your account stays protected.
                  </p>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
                  <Shield className="h-7 w-7" />
                </div>
              </div>
            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <div className="mb-4 flex items-center text-blue-900">
                  <Mail className="mr-2 h-5 w-5" />
                  <h3 className="font-semibold">How reauthentication works</h3>
                </div>
                <ol className="space-y-3 text-sm text-blue-950/80">
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">1</span>
                    Send a verification code to your account email.
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">2</span>
                    Enter the code here with your new password.
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">3</span>
                    Supabase verifies the code before saving the password change.
                  </li>
                </ol>

                <button
                  type="button"
                  onClick={handleSendReauthCode}
                  disabled={securityLoading}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {securityLoading && !reauthEmailSent ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  {reauthEmailSent ? 'Send another code' : 'Email me a verification code'}
                </button>
              </div>

              <form name="profile-change-password" method="POST" data-netlify="true" onSubmit={handleChangePassword} className="space-y-4">
                <input type="hidden" name="form-name" value="profile-change-password" readOnly />
                <div>
                  <label htmlFor="new-password" className="mb-2 flex items-center text-sm font-semibold text-gray-800">
                    <Lock className="mr-2 h-4 w-4 text-gray-500" />
                    New password
                  </label>
                  <input
                    id="new-password"
                    name="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={10}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    placeholder="At least 10 characters"
                  />
                </div>

                <div>
                  <label htmlFor="confirm-new-password" className="mb-2 flex items-center text-sm font-semibold text-gray-800">
                    <Lock className="mr-2 h-4 w-4 text-gray-500" />
                    Confirm new password
                  </label>
                  <input
                    id="confirm-new-password"
                    name="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={10}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    placeholder="Re-enter your new password"
                  />
                </div>

                <div>
                  <label htmlFor="reauth-code" className="mb-2 flex items-center text-sm font-semibold text-gray-800">
                    <KeyRound className="mr-2 h-4 w-4 text-gray-500" />
                    Email verification code
                  </label>
                  <input
                    id="reauth-code"
                    name="reauthCode"
                    type="text"
                    value={reauthCode}
                    onChange={(event) => setReauthCode(event.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    placeholder="Enter the code from your email"
                  />
                </div>

                {securityMessage && (
                  <div className={`rounded-xl border p-3 text-sm ${
                    securityMessage.ok
                      ? 'border-green-200 bg-green-50 text-green-800'
                      : 'border-red-200 bg-red-50 text-red-800'
                  }`}>
                    {securityMessage.text}
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="submit"
                    disabled={securityLoading || !reauthEmailSent}
                    className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#4B9EC8] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3d8bb3] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {securityLoading && reauthEmailSent ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Shield className="mr-2 h-4 w-4" />
                    )}
                    Update password securely
                  </button>
                  <button
                    type="button"
                    onClick={resetPasswordForm}
                    className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    Clear
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <Camera className="w-5 h-5 text-blue-600 mr-1" />
              </div>
              <div className="text-2xl font-bold text-blue-600">{userStats.totalPosts}</div>
              <div className="text-sm text-gray-600">Posts</div>
            </div>

            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <MessageSquare className="w-5 h-5 text-purple-600 mr-1" />
              </div>
              <div className="text-2xl font-bold text-purple-600">{userStats.totalComments}</div>
              <div className="text-sm text-gray-600">Comments</div>
            </div>

            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <CheckCircle className="w-5 h-5 text-green-600 mr-1" />
              </div>
              <div className="text-2xl font-bold text-green-600">{userStats.totalGreenFlags}</div>
              <div className="text-sm text-gray-600">Green Flags</div>
            </div>

            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <Flag className="w-5 h-5 text-red-600 mr-1" />
              </div>
              <div className="text-2xl font-bold text-red-600">{userStats.totalRedFlags}</div>
              <div className="text-sm text-gray-600">Red Flags</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <ImageIcon className="w-5 h-5 mr-2" />
            Posts ({userStats.totalPosts})
          </h2>

          {userPosts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Camera className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No posts yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {userPosts.map((post) => (
                <div key={post.id} className="relative group">
                  <div
                    className="aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer"
                    onClick={() => openImageModal(post.photo_url)}
                  >
                    <img
                      src={post.photo_url}
                      alt="User post"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity duration-200 flex items-center justify-center">
                      <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                    </div>
                  </div>

                  <div className="absolute bottom-2 left-2 right-2 flex justify-between">
                    <div className="flex items-center bg-green-500 bg-opacity-90 text-white px-2 py-1 rounded-full text-xs">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {post.green_flag_count}
                    </div>
                    <div className="flex items-center bg-red-500 bg-opacity-90 text-white px-2 py-1 rounded-full text-xs">
                      <XCircle className="w-3 h-3 mr-1" />
                      {post.red_flag_count}
                    </div>
                  </div>

                  {post.red_flag_count > 10 && (
                    <div className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold">
                      HIGH RISK
                    </div>
                  )}

                  <div className="mt-2 text-xs text-gray-500 text-center">
                    {new Date(post.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <MessageSquare className="w-5 h-5 mr-2" />
            Recent Comments ({userStats.totalComments})
          </h2>

          {userComments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No comments yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {userComments.map((comment) => (
                <div key={comment.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start space-x-4">
                    {comment.post && (
                      <div
                        className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg overflow-hidden cursor-pointer"
                        onClick={() => openImageModal(comment.post!.photo_url)}
                      >
                        <img
                          src={comment.post.photo_url}
                          alt="Post preview"
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                        />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center text-sm text-gray-500">
                          <span>Comment on post by</span>
                          {comment.post && (
                            <span className="font-medium text-gray-700 ml-1">
                              @{comment.post.username}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-gray-900 text-sm leading-relaxed">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {isImageModalOpen && selectedImage && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="relative max-w-4xl max-h-full">
              <button
                onClick={closeImageModal}
                className="absolute top-4 right-4 w-10 h-10 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-full flex items-center justify-center transition-colors z-10"
              >
                <X className="w-6 h-6" />
              </button>
              <img
                src={selectedImage}
                alt="Full size image"
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
