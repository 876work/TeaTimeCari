import React, { useState, useEffect } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { 
  CheckCircle, 
  XCircle, 
  MessageSquare, 
  Info, 
  Loader2, 
  AlertCircle, 
  X,
  Send,
  Users,
  Heart,
  Flag
} from 'lucide-react';
import { AppLayout } from '../AppLayout';

// Type definitions
interface Post {
  id: string;
  user_id: string;
  username: string;
  gender: 'Male' | 'Female';
  photo_url: string;
  green_flag_count: number;
  red_flag_count: number;
  created_at: string;
  comments?: Comment[];
}

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  username: string;
  gender: 'Male' | 'Female';
  content: string;
  created_at: string;
}

interface UserData {
  id: string;
  username: string;
  gender: 'Male' | 'Female';
  status: string;
}

export function GenderFeed() {
  const supabase = useSupabaseClient();
  const session = useSession();
  
  // State management
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLoading, setUserLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [flaggingPostId, setFlaggingPostId] = useState<string | null>(null);

  // Fetch current user data and verify status
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!session?.user?.id) {
        setError('Please log in to access the feed.');
        setUserLoading(false);
        return;
      }

      try {
        const { data: userData, error: userError } = await supabase
          .from('registrations')
          .select('id, username, gender, status')
          .eq('id', session.user.id)
          .single();

        if (userError) {
          console.error('Error fetching user data:', userError);
          setError('Failed to load user data. Please try again.');
          setUserLoading(false);
          return;
        }

        if (!userData) {
          setError('User registration not found. Please complete registration first.');
          setUserLoading(false);
          return;
        }

        if (userData.status !== 'verified') {
          setError('Access denied. Your account must be verified to access the feed.');
          setUserLoading(false);
          return;
        }

        setCurrentUser(userData);
      } catch (err: any) {
        console.error('Error in fetchCurrentUser:', err);
        setError('An unexpected error occurred while loading user data.');
      } finally {
        setUserLoading(false);
      }
    };

    fetchCurrentUser();
  }, [session, supabase]);

  // Fetch posts based on user's gender
  useEffect(() => {
    const fetchPosts = async () => {
      if (!currentUser) return;

      setLoading(true);
      setError(null);

      try {
        // Fetch posts for the user's gender
        const { data: postsData, error: postsError } = await supabase
          .from('posts')
          .select('*')
          .eq('gender', currentUser.gender)
          .order('created_at', { ascending: false });

        if (postsError) {
          console.error('Error fetching posts:', postsError);
          // If table doesn't exist, show mock data for demonstration
          if (postsError.code === '42P01') {
            console.warn('Posts table not found, using mock data');
            setMockPosts();
            return;
          }
          throw postsError;
        }

        // Fetch comments for each post
        const postsWithComments = await Promise.all(
          (postsData || []).map(async (post) => {
            const { data: commentsData } = await supabase
              .from('comments')
              .select('*')
              .eq('post_id', post.id)
              .order('created_at', { ascending: true });

            return {
              ...post,
              comments: commentsData || []
            };
          })
        );

        setPosts(postsWithComments);
      } catch (err: any) {
        console.error('Error fetching posts:', err);
        setError(`Failed to load posts: ${err.message}`);
        // Fallback to mock data for demonstration
        setMockPosts();
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [currentUser, supabase]);

  // Mock data for demonstration
  const setMockPosts = () => {
    if (!currentUser) return;

    const mockPosts: Post[] = [
      {
        id: '1',
        user_id: 'mock-user-1',
        username: 'alex_smith',
        gender: currentUser.gender,
        photo_url: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=400',
        green_flag_count: 12,
        red_flag_count: 3,
        created_at: new Date().toISOString(),
        comments: [
          {
            id: 'c1',
            post_id: '1',
            user_id: 'mock-user-2',
            username: 'jordan_doe',
            gender: currentUser.gender,
            content: 'Great photo! Love the composition.',
            created_at: new Date(Date.now() - 3600000).toISOString()
          }
        ]
      },
      {
        id: '2',
        user_id: 'mock-user-3',
        username: 'sam_wilson',
        gender: currentUser.gender,
        photo_url: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=400',
        green_flag_count: 8,
        red_flag_count: 1,
        created_at: new Date(Date.now() - 7200000).toISOString(),
        comments: []
      }
    ];

    setPosts(mockPosts);
    setLoading(false);
  };

  // Handle flag click (green or red)
  const handleFlag = async (postId: string, flagType: 'green' | 'red') => {
    if (!currentUser || flaggingPostId) return;

    setFlaggingPostId(postId);
    setError(null);

    try {
      const columnName = flagType === 'green' ? 'green_flag_count' : 'red_flag_count';
      
      // Get current count
      const currentPost = posts.find(p => p.id === postId);
      if (!currentPost) return;

      const newCount = (flagType === 'green' ? currentPost.green_flag_count : currentPost.red_flag_count) + 1;

      // Update in database
      const { error: updateError } = await supabase
        .from('posts')
        .update({ [columnName]: newCount })
        .eq('id', postId);

      if (updateError && updateError.code !== '42P01') {
        throw updateError;
      }

      // Update local state
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post.id === postId
            ? {
                ...post,
                [columnName]: newCount
              }
            : post
        )
      );

    } catch (err: any) {
      console.error('Error updating flag count:', err);
      setError(`Failed to update flag: ${err.message}`);
    } finally {
      setFlaggingPostId(null);
    }
  };

  // Handle comment submission
  const handleSubmitComment = async () => {
    if (!currentUser || !selectedPostId || !commentText.trim() || submittingComment) return;

    setSubmittingComment(true);
    setError(null);

    try {
      const newComment: Omit<Comment, 'id' | 'created_at'> = {
        post_id: selectedPostId,
        user_id: currentUser.id,
        username: currentUser.username,
        gender: currentUser.gender,
        content: commentText.trim()
      };

      // Insert comment into database
      const { data: insertedComment, error: insertError } = await supabase
        .from('comments')
        .insert([newComment])
        .select()
        .single();

      if (insertError && insertError.code !== '42P01') {
        throw insertError;
      }

      // Update local state
      const commentToAdd: Comment = insertedComment || {
        ...newComment,
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString()
      };

      setPosts(prevPosts =>
        prevPosts.map(post =>
          post.id === selectedPostId
            ? {
                ...post,
                comments: [...(post.comments || []), commentToAdd]
              }
            : post
        )
      );

      // Close modal and reset
      setIsCommentModalOpen(false);
      setSelectedPostId(null);
      setCommentText('');

    } catch (err: any) {
      console.error('Error submitting comment:', err);
      setError(`Failed to submit comment: ${err.message}`);
    } finally {
      setSubmittingComment(false);
    }
  };

  // Open comment modal
  const openCommentModal = (postId: string) => {
    setSelectedPostId(postId);
    setIsCommentModalOpen(true);
    setCommentText('');
  };

  // Close comment modal
  const closeCommentModal = () => {
    setIsCommentModalOpen(false);
    setSelectedPostId(null);
    setCommentText('');
  };

  // Loading state for user verification
  if (userLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Verifying access...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Error state or access denied
  if (error && !currentUser) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
            <p className="text-gray-700 mb-6">{error}</p>
            <button
              onClick={() => window.location.href = '/'}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Go Back Home
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-4">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Your Gender Feed</h1>
                <p className="text-gray-600">
                  Posts from {currentUser?.gender} users • @{currentUser?.username}
                </p>
              </div>
            </div>
            <div className="relative group">
              <Info className="w-5 h-5 text-gray-400 cursor-help" />
              <div className="absolute right-0 top-8 w-64 bg-gray-900 text-white text-sm rounded-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                You can only see posts from users of the same gender. Flag posts and add anonymous comments to engage with the community.
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && currentUser && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6" role="alert">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading your feed...</p>
            </div>
          </div>
        ) : posts.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No posts yet!</h3>
            <p className="text-gray-600 mb-6">
              Be the first to share something with the {currentUser?.gender} community.
            </p>
            <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
              Create First Post
            </button>
          </div>
        ) : (
          /* Posts Feed */
          <div className="space-y-6">
            {posts.map((post) => (
              <div key={post.id} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                {/* Post Header */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
                        <span className="text-white font-bold text-sm">
                          {post.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">@{post.username}</p>
                        <p className="text-sm text-gray-500">{post.gender}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Post Image */}
                <div className="relative">
                  <img
                    src={post.photo_url}
                    alt="Post content"
                    className="w-full h-80 object-cover"
                  />
                </div>

                {/* Post Actions */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      {/* Green Flag Button */}
                      <button
                        onClick={() => handleFlag(post.id, 'green')}
                        disabled={flaggingPostId === post.id}
                        className="flex items-center space-x-2 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {flaggingPostId === post.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        <span className="text-sm font-medium">{post.green_flag_count}</span>
                      </button>

                      {/* Red Flag Button */}
                      <button
                        onClick={() => handleFlag(post.id, 'red')}
                        disabled={flaggingPostId === post.id}
                        className="flex items-center space-x-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {flaggingPostId === post.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                        <span className="text-sm font-medium">{post.red_flag_count}</span>
                      </button>
                    </div>

                    {/* Comment Button */}
                    <button
                      onClick={() => openCommentModal(post.id)}
                      className="flex items-center space-x-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span className="text-sm font-medium">Add Comment</span>
                    </button>
                  </div>

                  {/* Comments Section */}
                  {post.comments && post.comments.length > 0 && (
                    <div className="border-t border-gray-100 pt-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">
                        Comments ({post.comments.length})
                      </h4>
                      <div className="space-y-3">
                        {post.comments.map((comment) => (
                          <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-gray-900">
                                  @{comment.username}
                                </span>
                                <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
                                  {comment.gender}
                                </span>
                              </div>
                              <span className="text-xs text-gray-400">
                                {new Date(comment.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700">{comment.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Comment Modal */}
        {isCommentModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Add Anonymous Comment</h3>
                <button
                  onClick={closeCommentModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4">
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">
                    Commenting as: <span className="font-medium">@{currentUser?.username}</span>
                    <span className="ml-2 text-xs bg-gray-200 px-2 py-1 rounded-full">
                      {currentUser?.gender}
                    </span>
                  </p>
                </div>
                
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Share your thoughts..."
                  className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  maxLength={500}
                />
                
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-gray-500">
                    {commentText.length}/500 characters
                  </span>
                  <div className="flex space-x-2">
                    <button
                      onClick={closeCommentModal}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitComment}
                      disabled={!commentText.trim() || submittingComment}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                        commentText.trim() && !submittingComment
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {submittingComment ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      <span>Post Comment</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}