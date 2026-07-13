import React, { useState, useEffect } from "react";
import { useSupabaseClient, useSession } from "@supabase/auth-helpers-react";
import {
  User,
  Calendar,
  MessageSquare,
  Image as ImageIcon,
  ArrowLeft,
  Shield,
  ShieldOff,
  Loader2,
  AlertCircle,
  Eye,
  X,
  Users,
  Camera,
  Lock,
  Mail,
  KeyRound,
  FileText,
  Clock,
  ExternalLink,
} from "lucide-react";
import { isValidUUID } from "../../utils/validationUtils";
import { isApprovedRegistrationStatus } from "@/lib/auth/approvalStatus";

// Type definitions
interface UserProfileData {
  id: string;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  username: string;
  gender: "Male" | "Female";
  status: string;
  created_at: string;
}

interface DiscoursePhoto {
  id: string;
  url: string;
  post_url: string;
  topic_title: string;
  created_at: string | null;
}

interface DiscourseComment {
  id: string;
  content: string;
  created_at: string | null;
  topic_id: number | null;
  post_id: number | string | null;
  post_number: number | null;
  topic_title: string;
  topic_slug: string | null;
  target_username: string | null;
  url: string;
}

interface UserStats {
  totalPhotos: number;
  totalComments: number;
  totalTopics: number;
  lastActivityAt: string | null;
}

interface DiscourseActivityResponse {
  ok: boolean;
  discourseBaseUrl?: string;
  username?: string | null;
  photos?: DiscoursePhoto[];
  recentComments?: DiscourseComment[];
  stats?: Partial<UserStats>;
  error?: string;
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
  const [discoursePhotos, setDiscoursePhotos] = useState<DiscoursePhoto[]>([]);
  const [recentComments, setRecentComments] = useState<DiscourseComment[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({
    totalPhotos: 0,
    totalComments: 0,
    totalTopics: 0,
    lastActivityAt: null,
  });
  const [discourseError, setDiscourseError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [processingBan, setProcessingBan] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [reauthCode, setReauthCode] = useState("");
  const [reauthEmailSent, setReauthEmailSent] = useState(false);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityMessage, setSecurityMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      setError(null);

      try {
        if (!session?.user?.id) {
          setError("Please log in to view profiles.");
          return;
        }

        if (!userId) {
          setError("No user ID provided.");
          return;
        }

        if (!isValidUUID(userId)) {
          setError(
            "The provided user ID is not valid. Please check the URL and try again.",
          );
          return;
        }

        const { data: userData, error: userError } = await supabase
          .from("registrations")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();

        if (userError) {
          console.error("Error fetching current user:", userError);
          setError("Failed to load user data. Please try again.");
          return;
        }

        if (!userData) {
          setError(
            "User registration not found. Please complete registration first.",
          );
          return;
        }

        if (!canViewProfiles(userData.status)) {
          setError(
            "Access denied. Your account must be approved to view profiles.",
          );
          return;
        }

        setCurrentUser(userData);

        const userIsAdmin = session?.user?.email?.includes("admin") || false;
        setIsAdmin(userIsAdmin);

        if (userId !== session.user.id && !userIsAdmin) {
          setError("Access denied. You can only view your own profile.");
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from("registrations")
          .select(
            "id, firstName, lastName, username, gender, status, created_at",
          )
          .eq("id", userId)
          .maybeSingle();

        if (profileError) {
          console.error("Error fetching profile user:", profileError);
          if (profileError.code === "PGRST116") {
            setError("User not found.");
          } else {
            setError("Failed to load profile data.");
          }
          return;
        }

        if (!profileData) {
          setError("User not found.");
          return;
        }

        const fullName =
          [profileData.firstName, profileData.lastName]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          profileData.username ||
          "User";

        setProfileUser({ ...profileData, fullName });

        setDiscourseError(null);

        const { data: discourseData, error: discourseActivityError } =
          await supabase.functions.invoke<DiscourseActivityResponse>(
            "profile-discourse-activity",
            { body: { userId } },
          );

        if (discourseActivityError) {
          console.error(
            "Error fetching Discourse activity:",
            discourseActivityError,
          );
          setDiscourseError(
            "We could not load Discourse activity right now. Please try again later.",
          );
          setDiscoursePhotos([]);
          setRecentComments([]);
          setUserStats({
            totalPhotos: 0,
            totalComments: 0,
            totalTopics: 0,
            lastActivityAt: null,
          });
        } else if (discourseData?.error) {
          setDiscourseError(discourseData.error);
          setDiscoursePhotos([]);
          setRecentComments([]);
          setUserStats({
            totalPhotos: 0,
            totalComments: 0,
            totalTopics: 0,
            lastActivityAt: null,
          });
        } else {
          const photos = discourseData?.photos || [];
          const comments = discourseData?.recentComments || [];
          setDiscoursePhotos(photos);
          setRecentComments(comments.slice(0, 2));
          setUserStats({
            totalPhotos: discourseData?.stats?.totalPhotos ?? photos.length,
            totalComments:
              discourseData?.stats?.totalComments ?? comments.length,
            totalTopics: discourseData?.stats?.totalTopics ?? 0,
            lastActivityAt: discourseData?.stats?.lastActivityAt ?? null,
          });
        }
      } catch (err: unknown) {
        console.error("Error fetching user data:", err);
        setError(`Failed to load user data: ${getErrorMessage(err)}`);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [session, userId, supabase]);

  const handleToggleBan = async () => {
    if (!profileUser || !isAdmin || processingBan) return;

    const isBanned = profileUser.status === "banned";
    const action = isBanned ? "unban" : "ban";
    const confirmMessage = `Are you sure you want to ${action} @${profileUser.username}?`;

    if (!confirm(confirmMessage)) return;

    setProcessingBan(true);
    setError(null);

    try {
      const newStatus = isBanned ? "approved" : "banned";

      const { error: updateError } = await supabase
        .from("registrations")
        .update({ status: newStatus })
        .eq("id", userId);

      if (updateError && updateError.code !== "42P01") {
        throw updateError;
      }

      setProfileUser((prev) => (prev ? { ...prev, status: newStatus } : null));

      try {
        await supabase.from("moderation_logs").insert([
          {
            admin_id: session?.user?.id,
            action: `${action}_user`,
            target_user_id: userId,
            reason: `User ${action}ned via profile page`,
            created_at: new Date().toISOString(),
          },
        ]);
      } catch (logError) {
        console.warn("Failed to log moderation action:", logError);
      }

      alert(
        `User @${profileUser.username} has been ${action}ned successfully.`,
      );
    } catch (err: unknown) {
      console.error(`Error ${action}ning user:`, err);
      setError(`Failed to ${action} user: ${getErrorMessage(err)}`);
    } finally {
      setProcessingBan(false);
    }
  };

  const resetPasswordForm = () => {
    setNewPassword("");
    setConfirmPassword("");
    setReauthCode("");
    setReauthEmailSent(false);
  };

  const handleSendReauthCode = async () => {
    if (!session?.user?.email) {
      setSecurityMessage({
        ok: false,
        text: "Please sign in again before changing your password.",
      });
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
      setSecurityMessage({
        ok: false,
        text: "Your new password must be at least 10 characters long.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setSecurityMessage({
        ok: false,
        text: "The new passwords do not match.",
      });
      return;
    }

    if (!reauthCode.trim()) {
      setSecurityMessage({
        ok: false,
        text: "Enter the verification code from your reauthentication email.",
      });
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
    setSecurityMessage({
      ok: true,
      text: "Your password has been updated successfully.",
    });
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
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              Invalid User ID
            </h2>
            <p className="text-gray-700 mb-6">
              The provided user ID is not valid. Please check the URL and try
              again.
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
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              Profile Not Found
            </h2>
            <p className="text-gray-700 mb-6">
              {error || "Profile data could not be loaded."}
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

  const isOwnProfile = currentUser?.id === profileUser.id;
  const isBanned = profileUser.status === "banned";

  return (
    <div className="p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <button
          onClick={goBackToFeed}
          className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Feed
        </button>

        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${
                  isBanned
                    ? "bg-red-100"
                    : profileUser.gender === "Male"
                      ? "bg-brand-blue-muted"
                      : "bg-brand-rose-muted"
                }`}
              >
                <User
                  className={`h-8 w-8 ${
                    isBanned
                      ? "text-red-600"
                      : profileUser.gender === "Male"
                        ? "text-brand-blue"
                        : "text-brand-rose"
                  }`}
                />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {profileUser.fullName}
                  </h1>
                  {isBanned && (
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
                      <ShieldOff className="mr-1 h-3 w-3" />
                      Banned
                    </span>
                  )}
                  {isOwnProfile && (
                    <span className="inline-flex items-center rounded-full bg-brand-blue-muted px-2 py-1 text-xs font-medium text-brand-blue-dark">
                      You
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                  <span>@{profileUser.username}</span>
                  <span className="inline-flex items-center">
                    <Users className="mr-1 h-3.5 w-3.5" />
                    {profileUser.gender}
                  </span>
                  <span className="inline-flex items-center">
                    <Calendar className="mr-1 h-3.5 w-3.5" />
                    Joined{" "}
                    {new Date(profileUser.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {isAdmin && !isOwnProfile && (
              <button
                onClick={handleToggleBan}
                disabled={processingBan}
                className={`flex items-center justify-center rounded-lg px-4 py-2 font-medium text-white transition-colors ${
                  isBanned
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                } ${processingBan ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {processingBan ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : isBanned ? (
                  <Shield className="w-4 h-4 mr-2" />
                ) : (
                  <ShieldOff className="w-4 h-4 mr-2" />
                )}
                {isBanned ? "Unban User" : "Ban User"}
              </button>
            )}
          </div>

          <div className="mt-4 flex items-center gap-1.5 border-t border-slate-100 pt-4 text-xs text-gray-500">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            This page is only visible to {isOwnProfile ? "you" : "you and admins"}.
            Username, gender, and join date may still appear in community
            posts and comments.
          </div>
        </div>

        {error && profileUser && (
          <div
            className="bg-red-50 border border-red-200 rounded-lg p-4"
            role="alert"
          >
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          </div>
        )}

        {isOwnProfile && (
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-brand-blue px-6 py-5 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Security settings</h2>
                  <p className="text-sm text-blue-50/90">
                    Change your password with an emailed verification code.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
                <div className="mb-4 flex items-center text-blue-900">
                  <Mail className="mr-2 h-5 w-5" />
                  <h3 className="font-semibold">How it works</h3>
                </div>
                <ol className="space-y-3 text-sm text-blue-950/80">
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                      1
                    </span>
                    Send a verification code to your account email.
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                      2
                    </span>
                    Enter the code here with your new password.
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                      3
                    </span>
                    We verify the code before saving the change.
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
                  {reauthEmailSent
                    ? "Send another code"
                    : "Email me a verification code"}
                </button>
              </div>

              <form
                name="profile-change-password"
                method="POST"
                data-netlify="true"
                onSubmit={handleChangePassword}
                className="space-y-4"
              >
                <input
                  type="hidden"
                  name="form-name"
                  value="profile-change-password"
                  readOnly
                />
                <div>
                  <label
                    htmlFor="new-password"
                    className="mb-2 flex items-center text-sm font-semibold text-gray-800"
                  >
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
                  <label
                    htmlFor="confirm-new-password"
                    className="mb-2 flex items-center text-sm font-semibold text-gray-800"
                  >
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
                  <label
                    htmlFor="reauth-code"
                    className="mb-2 flex items-center text-sm font-semibold text-gray-800"
                  >
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
                  <div
                    className={`rounded-xl border p-3 text-sm ${
                      securityMessage.ok
                        ? "border-green-200 bg-green-50 text-green-800"
                        : "border-red-200 bg-red-50 text-red-800"
                    }`}
                  >
                    {securityMessage.text}
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="submit"
                    disabled={securityLoading || !reauthEmailSent}
                    className="inline-flex flex-1 items-center justify-center rounded-xl bg-brand-blue px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
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

        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Community activity
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4 text-center">
              <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-brand-blue-muted">
                <Camera className="h-4 w-4 text-brand-blue" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {userStats.totalPhotos}
              </div>
              <div className="text-sm text-gray-500">Photos</div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 text-center">
              <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-brand-purple-muted">
                <MessageSquare className="h-4 w-4 text-brand-purple" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {userStats.totalComments}
              </div>
              <div className="text-sm text-gray-500">Comments</div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 text-center">
              <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-brand-rose-muted">
                <FileText className="h-4 w-4 text-brand-rose" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {userStats.totalTopics}
              </div>
              <div className="text-sm text-gray-500">Topics</div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 text-center">
              <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-slate-200">
                <Clock className="h-4 w-4 text-slate-600" />
              </div>
              <div className="text-sm font-bold text-gray-900">
                {userStats.lastActivityAt
                  ? new Date(userStats.lastActivityAt).toLocaleDateString()
                  : "No activity"}
              </div>
              <div className="text-sm text-gray-500">Last activity</div>
            </div>
          </div>
          {discourseError && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {discourseError}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-6">
          <h2 className="mb-4 flex items-center text-lg font-semibold text-gray-900">
            <ImageIcon className="w-5 h-5 mr-2" />
            Photos ({userStats.totalPhotos})
          </h2>

          {discoursePhotos.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Camera className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="font-medium text-gray-700">
                No Discourse photos yet
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm">
                Photos uploaded in Discourse will appear here after this member
                shares image attachments in the community.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {discoursePhotos.map((photo) => (
                <div key={photo.id} className="relative group">
                  <button
                    type="button"
                    className="aspect-square w-full bg-gray-100 rounded-xl overflow-hidden cursor-pointer text-left"
                    onClick={() => openImageModal(photo.url)}
                    aria-label={`Open photo from ${photo.topic_title}`}
                  >
                    <img
                      src={photo.url}
                      alt={`Discourse upload from ${photo.topic_title}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity duration-200 flex items-center justify-center">
                      <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                    </div>
                  </button>
                  <a
                    href={photo.post_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 flex items-center justify-center gap-1 text-xs font-medium text-brand-blue hover:text-brand-blue-dark"
                  >
                    View in Discourse
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  {photo.created_at && (
                    <div className="mt-1 text-xs text-gray-500 text-center">
                      {new Date(photo.created_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-6">
          <h2 className="mb-4 flex items-center text-lg font-semibold text-gray-900">
            <MessageSquare className="w-5 h-5 mr-2" />
            Recent Comments ({Math.min(recentComments.length, 2)} of{" "}
            {userStats.totalComments})
          </h2>

          {recentComments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No Discourse comments yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentComments.map((comment) => (
                <a
                  key={comment.id}
                  href={comment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-xl border border-gray-200 p-4 transition-colors hover:border-brand-blue-light hover:bg-brand-blue-muted/40"
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                        <span className="truncate">{comment.topic_title}</span>
                        <ExternalLink className="h-4 w-4 flex-shrink-0 text-brand-blue" />
                      </div>
                      {comment.target_username && (
                        <p className="mt-1 text-xs text-gray-500">
                          Commented to @{comment.target_username}
                        </p>
                      )}
                    </div>
                    {comment.created_at && (
                      <span className="flex-shrink-0 text-xs text-gray-400">
                        {new Date(comment.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {comment.content ||
                      "Open in Discourse to view this comment."}
                  </p>
                </a>
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
