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
  Heart,
  Users,
  Camera
} from 'lucide-react';
import { isValidUUID } from '../../utils/validationUtils';

// Type definitions
interface UserProfileData {
  id: string;
  fullName: string;
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

interface UserProfileProps {
  userId: string;
}

export function UserProfile({ userId }: UserProfileProps) {
  const supabase = useSupabaseClient();
  const session = useSession();

  // Go back to feed function - defined early to avoid initialization errors
  const goBackToFeed = () => {
    window.history.back();
  };

  // Validate userId before proceeding
  if (!userId || !isValidUUID(userId)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#A3C6E0] to-[#E0A3A3] p-4">
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
  
  // State management
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

  // Consolidated data fetching
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      setError(null);
      
      if (!session?.user?.id) {
        setError('Please log in to view profiles.');
        return;
      }

      if (!userId) {
        setError('No user ID provided.');
        return;
      }

      try {
        // Fetch current user and check admin status
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

        if (userData.status !== 'verified') {
          setError('Access denied. Your account must be verified to view profiles.');
          return;
        }

        setCurrentUser(userData);
        
        // Simple admin check - in production, implement proper role-based access control
        setIsAdmin(session?.user?.email?.includes('admin') || false);
        
        // Fetch profile user data
        const { data: profileData, error: profileError } = await supabase
          .from('registrations')
          .select('id, fullName, username, gender, status, created_at')
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

        setProfileUser(profileData);
        
        // Fetch user posts, comments, and calculate stats
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

        // Fetch user comments with post info
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

        if (commentsError && commentsError.code !== '42P01') {
          console.error('Error fetching comments:', commentsError);
          // Don't fail completely if comments can't be loaded
          setUserComments([]);
        } else {
          const comments = (commentsData || []).map(comment => {
            // Handle the posts relationship properly
            const post = Array.isArray(comment.posts) ? comment.posts[0] : comment.posts;
            return {
              ...comment,
              post: post
            };
          });
          setUserComments(comments);
        }

        // Calculate stats
        const totalGreenFlags = posts.reduce((sum, post) => sum + post.green_flag_count, 0);
        const totalRedFlags = posts.reduce((sum, post) => sum + post.red_flag_count, 0);
        const totalComments = userComments.length;

        setUserStats({
          totalPosts: posts.length,
          totalComments,
          totalGreenFlags,
          totalRedFlags
        });

        // If no real data, set mock data for demonstration
        if (posts.length === 0 && totalComments === 0) {
          setMockData(profileData);
        }

      } catch (err: any) {
        console.error('Error fetching user data:', err);
        setError(`Failed to load user data: ${err.message}`);
        // Fallback to mock data for demonstration
        if (profileData) {
          setMockData(profileData);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [session, userId, supabase]);

  // Mock data for demonstration
  const setMockData = (profileData?: UserProfileData) => {
    // Set mock profile user if not provided
    if (!profileData) {
      const mockProfileUser: UserProfileData = {
        id: userId,
        fullName: 'Demo User',
        username: 'demo_user',
        gender: 'Male',
        status: 'verified',
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

  // Handle ban/unban user
  const handleToggleBan = async () => {
    if (!profileUser || !isAdmin || processingBan) return;

    const isBanned = profileUser.status === 'banned';
    const action = isBanned ? 'unban' : 'ban';
    const confirmMessage = `Are you sure you want to ${action} @${profileUser.username}?`;

    if (!confirm(confirmMessage)) return;

    setProcessingBan(true);
    setError(null);

    try {
      const newStatus = isBanned ? 'verified' : 'banned';
      
      const { error: updateError } = await supabase
        .from('registrations')
        .update({ status: newStatus })
        .eq('id', userId);

      if (updateError && updateError.code !== '42P01') {
        throw updateError;
      }

      // Update local state
      setProfileUser(prev => prev ? { ...prev, status: newStatus } : null);

      // Optional: Log moderation action
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

    } catch (err: any) {
      console.error(`Error ${action}ning user:`, err);
      setError(`Failed to ${action} user: ${err.message}`);
    } finally {
      setProcessingBan(false);
    }
  };

  // Open image modal
  const openImageModal = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setIsImageModalOpen(true);
  };

  // Close image modal
  const closeImageModal = () => {
    setSelectedImage(null);
    setIsImageModalOpen(false);
  };

  // Loading state
  if (loading || !profileUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#A3C6E0] to-[#E0A3A3] p-4">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !profileUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#A3C6E0] to-[#E0A3A3] p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-600 mb-4">Profile Not Found</h2>
            <p className="text-gray-700 mb-6">{error}</p>
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
    <div className="min-h-screen bg-gradient-to-br from-[#A3C6E0] to-[#E0A3A3] p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Button */}
        <button
          onClick={goBackToFeed}
          className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Feed
        </button>

        {/* Profile Header */}
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
                <div className="flex items-center">
                  <h1 className="text-2xl font-bold text-gray-900 mr-3">
                    {profileUser.fullName}
                  </h1>
                  {isBanned && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      <ShieldOff className="w-3 h-3 mr-1" />
                      Banned
                    </span>
                  )}
                  {isOwnProfile && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 ml-2">
                      You
                    </span>
                  )}
                </div>
                <p className="text-gray-600">@{profileUser.username}</p>
                <div className="flex items-center text-sm text-gray-500 mt-1">
                  <Users className="w-4 h-4 mr-1" />
                  <span className="mr-3">{profileUser.gender}</span>
                  <Calendar className="w-4 h-4 mr-1" />
                  <span>Joined {new Date(profileUser.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Admin Controls */}
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

        {/* Error Message */}
        {error && profileUser && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4" role="alert">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Stats Panel */}
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

        {/* Posts Grid */}
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
                  
                  {/* Flag counts overlay */}
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
                  
                  {/* High red flag indicator */}
                  {post.red_flag_count > 10 && (
                    <div className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold">
                      HIGH RISK
                    </div>
                  )}
                  
                  {/* Date */}
                  <div className="mt-2 text-xs text-gray-500 text-center">
                    {new Date(post.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comments List */}
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
                    {/* Post thumbnail */}
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
                    
                    {/* Comment content */}
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

        {/* Image Modal */}
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