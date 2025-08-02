import React, { useState, useEffect, useRef } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { isValidUUID } from '../../utils/validationUtils';
import { 
  ArrowLeft, 
  MessageSquare, 
  Send, 
  CheckCircle, 
  XCircle, 
  Users, 
  Calendar, 
  Loader2, 
  AlertCircle,
  RefreshCw,
  Flag,
  Heart,
  User,
  Clock
} from 'lucide-react';
import { AppLayout } from '../AppLayout';

// Type definitions
interface PostData {
  id: string;
  user_id: string;
  username: string;
  gender: 'Male' | 'Female';
  photo_url: string;
  green_flag_count: number;
  red_flag_count: number;
  created_at: string;
}

interface CommentData {
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

interface PostThreadProps {
  postId: string;
}

export function PostThread({ postId }: PostThreadProps) {
  const supabase = useSupabaseClient();
  const session = useSession();
  
  // State management
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [post, setPost] = useState<PostData | null>(null);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLoading, setUserLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [flaggingPost, setFlaggingPost] = useState(false);
  
  // Refs
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Fetch current user data and verify status
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!session?.user?.id) {
        setError('Please log in to view post threads.');
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
          setError('Access denied. Your account must be verified to view post threads.');
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

  // Fetch post data
  useEffect(() => {
    const fetchPost = async () => {
      if (!currentUser || !postId) {
        if (!postId) {
          setError('No post selected.');
          setLoading(false);
        }
        return;
      }

      // Validate UUID format
      if (!isValidUUID(postId)) {
        setError('Invalid post ID format.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data: postData, error: postError } = await supabase
          .from('posts')
          .select('*')
          .eq('id', postId)
          .single();

        if (postError) {
          console.error('Error fetching post:', postError);
          if (postError.code === 'PGRST116') {
            setError('Post not found or has been deleted.');
          } else if (postError.code === '42P01') {
            console.warn('Posts table not found, using mock data');
            setMockPost();
            return;
          } else {
            setError('Failed to load post data.');
          }
          setLoading(false);
          return;
        }

        setPost(postData);
      } catch (err: any) {
        console.error('Error fetching post:', err);
        setError('Failed to load post data.');
        // Fallback to mock data for demonstration
        setMockPost();
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [currentUser, postId, supabase]);

  // Fetch comments
  useEffect(() => {
    const fetchComments = async () => {
      if (!post) return;

      setCommentsLoading(true);

      try {
        const { data: commentsData, error: commentsError } = await supabase
          .from('comments')
          .select('*')
          .eq('post_id', postId)
          .order('created_at', { ascending: true });

        if (commentsError) {
          console.error('Error fetching comments:', commentsError);
          if (commentsError.code === '42P01') {
            console.warn('Comments table not found, using mock data');
            setMockComments();
            return;
          }
          throw commentsError;
        }

        setComments(commentsData || []);
      } catch (err: any) {
        console.error('Error fetching comments:', err);
        // Fallback to mock data for demonstration
        setMockComments();
      } finally {
        setCommentsLoading(false);
      }
    };

    fetchComments();
  }, [post, postId, supabase]);

  // Auto-refresh comments every 10 seconds for live updates
  useEffect(() => {
    if (!post) return;

    const interval = setInterval(async () => {
      try {
        const { data: commentsData, error: commentsError } = await supabase
          .from('comments')
          .select('*')
          .eq('post_id', postId)
          .order('created_at', { ascending: true });

        if (!commentsError && commentsData) {
          setComments(commentsData);
        }
      } catch (err) {
        console.warn('Failed to refresh comments:', err);
      }
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [post, postId, supabase]);

  // Scroll to bottom when new comments are added
  useEffect(() => {
    if (commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments]);

  // Mock data for demonstration
  const setMockPost = () => {
    if (!currentUser) return;

    const oppositeGender = currentUser.gender === 'Male' ? 'Female' : 'Male';
    const mockPost: PostData = {
      id: postId,
      user_id: 'mock-user-1',
      username: 'demo_user',
      gender: oppositeGender,
      photo_url: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=800',
      green_flag_count: 18,
      red_flag_count: 3,
      created_at: new Date().toISOString()
    };

    setPost(mockPost);
    setLoading(false);
  };

  const setMockComments = () => {
    if (!currentUser) return;

    const mockComments: CommentData[] = [
      {
        id: '1',
        post_id: postId,
        user_id: 'mock-user-2',
        username: 'commenter_one',
        gender: currentUser.gender,
        content: 'This is a really great photo! Love the composition and lighting.',
        created_at: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: '2',
        post_id: postId,
        user_id: 'mock-user-3',
        username: 'photo_enthusiast',
        gender: currentUser.gender === 'Male' ? 'Female' : 'Male',
        content: 'Amazing shot! What camera did you use for this?',
        created_at: new Date(Date.now() - 1800000).toISOString()
      },
      {
        id: '3',
        post_id: postId,
        user_id: 'mock-user-4',
        username: 'art_lover',
        gender: currentUser.gender,
        content: 'The colors in this photo are absolutely stunning. Thanks for sharing!',
        created_at: new Date(Date.now() - 900000).toISOString()
      }
    ];

    setComments(mockComments);
    setCommentsLoading(false);
  };

  // Handle flag click (green or red)
  const handleFlag = async (flagType: 'green' | 'red') => {
    if (!currentUser || !post || flaggingPost) return;

    setFlaggingPost(true);
    setError(null);

    try {
      const columnName = flagType === 'green' ? 'green_flag_count' : 'red_flag_count';
      const currentCount = flagType === 'green' ? post.green_flag_count : post.red_flag_count;
      const newCount = currentCount + 1;

      // Update in database
      const { error: updateError } = await supabase
        .from('posts')
        .update({ [columnName]: newCount })
        .eq('id', postId);

      if (updateError && updateError.code !== '42P01') {
        throw updateError;
      }

      // Update local state
      setPost(prevPost => prevPost ? {
        ...prevPost,
        [columnName]: newCount
      } : null);

    } catch (err: any) {
      console.error('Error updating flag count:', err);
      setError(`Failed to update flag: ${err.message}`);
    } finally {
      setFlaggingPost(false);
    }
  };

  // Handle comment submission
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser || !post || !newComment.trim() || submittingComment) return;

    setSubmittingComment(true);
    setError(null);

    try {
      const commentData: Omit<CommentData, 'id' | 'created_at'> = {
        post_id: postId,
        user_id: currentUser.id,
        username: currentUser.username,
        gender: currentUser.gender,
        content: newComment.trim()
      };

      // Insert comment into database
      const { data: insertedComment, error: insertError } = await supabase
        .from('comments')
        .insert([commentData])
        .select()
        .single();

      if (insertError && insertError.code !== '42P01') {
        throw insertError;
      }

      // Add to local state
      const commentToAdd: CommentData = insertedComment || {
        ...commentData,
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString()
      };

      setComments(prevComments => [...prevComments, commentToAdd]);
      setNewComment('');

      // Focus back on input for easy follow-up comments
      if (commentInputRef.current) {
        commentInputRef.current.focus();
      }

    } catch (err: any) {
      console.error('Error submitting comment:', err);
      setError(`Failed to submit comment: ${err.message}`);
    } finally {
      setSubmittingComment(false);
    }
  };

  // Manual refresh comments
  const refreshComments = async () => {
    if (!post) return;

    setCommentsLoading(true);
    try {
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (!commentsError && commentsData) {
        setComments(commentsData);
      }
    } catch (err) {
      console.warn('Failed to refresh comments:', err);
    } finally {
      setCommentsLoading(false);
    }
  };

  // Go back to feed
  const goBackToFeed = () => {
    window.history.back();
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

  // Loading state for post
  if (loading || !post) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading post...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Post not found or deleted
  if (error && !post) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-600 mb-4">Post Not Found</h2>
            <p className="text-gray-700 mb-6">
              {error || 'This post may have been deleted or you may not have permission to view it.'}
            </p>
            <button
              onClick={goBackToFeed}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Back to Feed
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const isValidComment = newComment.trim().length > 0 && newComment.length <= 500;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Back Button */}
        <button
          onClick={goBackToFeed}
          className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Feed
        </button>

        {/* Post Header */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Post Metadata */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${
                  post.gender === 'Male' ? 'bg-blue-100' : 'bg-pink-100'
                }`}>
                  <User className={`w-6 h-6 ${
                    post.gender === 'Male' ? 'text-blue-600' : 'text-pink-600'
                  }`} />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">@{post.username}</h1>
                  <div className="flex items-center text-sm text-gray-500">
                    <Users className="w-4 h-4 mr-1" />
                    <span className="mr-3">{post.gender}</span>
                    <Calendar className="w-4 h-4 mr-1" />
                    <span>{new Date(post.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              
              {/* Flag Actions */}
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleFlag('green')}
                  disabled={flaggingPost}
                  className="flex items-center space-x-2 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {flaggingPost ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  <span className="font-medium">{post.green_flag_count}</span>
                </button>

                <button
                  onClick={() => handleFlag('red')}
                  disabled={flaggingPost}
                  className="flex items-center space-x-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {flaggingPost ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  <span className="font-medium">{post.red_flag_count}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Post Image */}
          <div className="relative">
            <img
              src={post.photo_url}
              alt="Post content"
              className="w-full h-96 object-cover"
            />
            {post.red_flag_count > 10 && (
              <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                HIGH RISK
              </div>
            )}
          </div>
        </div>

        {/* Comments Section */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <MessageSquare className="w-5 h-5 mr-2" />
              Comments ({comments.length})
            </h2>
            <button
              onClick={refreshComments}
              disabled={commentsLoading}
              className="flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${commentsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg" role="alert">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                <span className="text-red-700 text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* Comments List */}
          <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
            {commentsLoading && comments.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin mr-2" />
                <span className="text-gray-600">Loading comments...</span>
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No comments yet</p>
                <p className="text-sm">Be the first to share your thoughts!</p>
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        comment.gender === 'Male' ? 'bg-blue-100' : 'bg-pink-100'
                      }`}>
                        <span className={`text-xs font-bold ${
                          comment.gender === 'Male' ? 'text-blue-600' : 'text-pink-600'
                        }`}>
                          {comment.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">@{comment.username}</span>
                        <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                          comment.gender === 'Male' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-pink-100 text-pink-700'
                        }`}>
                          {comment.gender}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center text-xs text-gray-500">
                      <Clock className="w-3 h-3 mr-1" />
                      <span>{new Date(comment.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="text-gray-800 leading-relaxed ml-10">{comment.content}</p>
                </div>
              ))
            )}
            <div ref={commentsEndRef} />
          </div>

          {/* Add Comment Form */}
          <form onSubmit={handleSubmitComment} className="border-t border-gray-200 pt-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reply to this post
              </label>
            </div>
            <div className="flex items-start space-x-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                currentUser.gender === 'Male' ? 'bg-blue-100' : 'bg-pink-100'
              }`}>
                <span className={`text-sm font-bold ${
                  currentUser.gender === 'Male' ? 'text-blue-600' : 'text-pink-600'
                }`}>
                  {currentUser.username.charAt(0).toUpperCase()}
                </span>
              </div>
              
              <div className="flex-1">
                <div className="mb-2">
                  <span className="text-sm text-gray-600">
                    Commenting as: <span className="font-medium">@{currentUser.username}</span>
                    <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                      currentUser.gender === 'Male' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-pink-100 text-pink-700'
                    }`}>
                      {currentUser.gender}
                    </span>
                  </span>
                </div>
                
                <textarea
                  ref={commentInputRef}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Share your thoughts on this post..."
                  className={`w-full h-24 px-4 py-3 border rounded-lg resize-none transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    newComment.length > 500 
                      ? 'border-red-300 bg-red-50' 
                      : 'border-gray-300 bg-white hover:border-gray-400'
                  }`}
                  maxLength={500}
                  disabled={submittingComment}
                />
                
                <div className="flex items-center justify-between mt-3">
                  <span className={`text-xs ${
                    newComment.length > 500 ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {newComment.length}/500 characters
                  </span>
                  
                  <button
                    type="submit"
                    disabled={!isValidComment || submittingComment}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                      isValidComment && !submittingComment
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transform hover:scale-[1.02]'
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
          </form>
        </div>

        {/* Live Updates Indicator */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-center text-sm text-blue-800">
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            <span>Comments update automatically every 10 seconds</span>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}