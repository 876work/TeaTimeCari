import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Lock,
  CreditCard,
  Star,
  Clock
} from 'lucide-react';
import { isApprovedRegistrationStatus } from '@/lib/auth/approvalStatus';
import { anonymousComposerHelperText } from '@/content/anonymousMode';
import { StripeProvider } from '../Payment/StripeProvider';
import { PaymentForm } from '../Payment/PaymentForm';

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

interface PaymentRecord {
  id: string;
  user_id: string;
  feed_access: string;
  status: string;
  expires_at: string;
  created_at: string;
}

export function OppositeGenderFeed() {
  const supabase = useSupabaseClient();
  const session = useSession();
  const navigate = useNavigate();
  
  // State management
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLoading, setUserLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [paymentRecord, setPaymentRecord] = useState<PaymentRecord | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  
  // Comment modal state
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

        if (!isApprovedRegistrationStatus(userData.status)) {
          setError('Access denied. Your account must be approved to access the feed.');
          setUserLoading(false);
          return;
        }

        setCurrentUser(userData);
      } catch (err: unknown) {
        console.error('Error in fetchCurrentUser:', err);
        setError('An unexpected error occurred while loading user data.');
      } finally {
        setUserLoading(false);
      }
    };

    fetchCurrentUser();
  }, [session, supabase]);

  // Check payment status and access
  useEffect(() => {
    const checkPaymentAccess = async () => {
      if (!currentUser) return;

      try {
        // Check for valid payment within last 3 days
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        const { data: paymentData, error: paymentError } = await supabase
          .from('payments')
          .select('*')
          .eq('user_id', currentUser.id)
          .eq('feed_access', 'opposite')
          .eq('status', 'completed')
          .gte('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (paymentError && paymentError.code !== 'PGRST116') {
          console.error('Error checking payment status:', paymentError);
          // Don't fail completely, just assume no access
        }

        if (paymentData) {
          setHasAccess(true);
          setPaymentRecord(paymentData);
        } else {
          setHasAccess(false);
          setPaymentRecord(null);
        }
      } catch (err: unknown) {
        console.error('Error checking payment access:', err);
        setHasAccess(false);
      }
    };

    checkPaymentAccess();
  }, [currentUser, supabase]);

  // Fetch posts for opposite gender (only if access is granted)
  useEffect(() => {
    const fetchPosts = async () => {
      if (!currentUser || !hasAccess) return;

      setLoading(true);
      setError(null);

      try {
        // Get opposite gender
        const oppositeGender = currentUser.gender === 'Male' ? 'Female' : 'Male';

        // Fetch posts for the opposite gender
        const { data: postsData, error: postsError } = await supabase
          .from('posts')
          .select('*')
          .eq('gender', oppositeGender)
          .order('created_at', { ascending: false });

        if (postsError) {
          console.error('Error fetching posts:', postsError);
          // If table doesn't exist, show mock data for demonstration
          if (postsError.code === '42P01') {
            console.warn('Posts table not found, using mock data');
            setMockPosts(oppositeGender);
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
      } catch (err: unknown) {
        console.error('Error fetching posts:', err);
        setError(err instanceof Error ? `Failed to load posts: ${err.message}` : 'Failed to load posts.');
        // Fallback to mock data for demonstration
        if (currentUser) {
          const oppositeGender = currentUser.gender === 'Male' ? 'Female' : 'Male';
          setMockPosts(oppositeGender);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [currentUser, hasAccess, supabase]);

  // Mock data for demonstration
  const setMockPosts = (gender: 'Male' | 'Female') => {
    const mockPosts: Post[] = [
      {
        id: '1',
        user_id: 'mock-user-1',
        username: 'alex_premium',
        gender: gender,
        photo_url: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=400',
        green_flag_count: 15,
        red_flag_count: 2,
        created_at: new Date().toISOString(),
        comments: [
          {
            id: 'c1',
            post_id: '1',
            user_id: 'mock-user-2',
            username: 'jordan_premium',
            gender: gender,
            content: 'Amazing photo! Premium content is worth it.',
            created_at: new Date(Date.now() - 3600000).toISOString()
          }
        ]
      },
      {
        id: '2',
        user_id: 'mock-user-3',
        username: 'sam_exclusive',
        gender: gender,
        photo_url: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=400',
        green_flag_count: 22,
        red_flag_count: 1,
        created_at: new Date(Date.now() - 7200000).toISOString(),
        comments: []
      }
    ];

    setPosts(mockPosts);
    setLoading(false);
  };

  // Handle payment success
  const handlePaymentSuccess = () => {
    setHasAccess(true);
    setShowPaymentForm(false);
    setError(null);
    // Refresh the page to load content
    window.location.reload();
  };

  // Handle payment error
  const handlePaymentError = (errorMessage: string) => {
    setError(`Payment failed: ${errorMessage}`);
    setShowPaymentForm(false);
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

    } catch (err: unknown) {
      console.error('Error updating flag count:', err);
      setError(err instanceof Error ? `Failed to update flag: ${err.message}` : 'Failed to update flag.');
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

    } catch (err: unknown) {
      console.error('Error submitting comment:', err);
      setError(err instanceof Error ? `Failed to submit comment: ${err.message}` : 'Failed to submit comment.');
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
      <div>
        <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Verifying access...</p>
          </div>
        </div>
        </div>
      </div>
    );
  }

  // Error state or access denied
  if (error && !currentUser) {
    return (
      <div>
        <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
            <p className="text-gray-700 mb-6">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Go Back Home
            </button>
          </div>
        </div>
        </div>
      </div>
    );
  }

  // Premium paywall screen
  if (currentUser && !hasAccess) {
    const oppositeGender = currentUser.gender === 'Male' ? 'Female' : 'Male';
    
    return (
      <StripeProvider>
        <div>
          <div className="container mx-auto px-4 py-8">
          <div className="max-w-lg mx-auto">
            {showPaymentForm ? (
              /* Payment Form */
              <div className="bg-white rounded-2xl shadow-xl p-8">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-gradient-to-br from-[#E0A3A3] to-[#D98B8B] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <CreditCard className="w-8 h-8 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">Complete Your Payment</h1>
                  <p className="text-gray-600">
                    Secure payment for 3-day {oppositeGender} feed access
                  </p>
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

                <PaymentForm
                  amount={2999}
                  currency="usd"
                  feedAccess="opposite"
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />

                <div className="mt-6 text-center">
                  <button
                    onClick={() => setShowPaymentForm(false)}
                    className="text-gray-600 hover:text-gray-800 underline"
                  >
                    ← Back to premium info
                  </button>
                </div>
              </div>
            ) : (
              /* Premium Info Screen */
              <div className="bg-white rounded-2xl shadow-xl p-10">
                {/* Premium Header */}
                <div className="text-center mb-10">
                  <div className="w-24 h-24 bg-gradient-to-br from-[#E0A3A3] to-[#D98B8B] rounded-2xl flex items-center justify-center mx-auto mb-8 relative shadow-2xl">
                    <Lock className="w-12 h-12 text-white" />
                    <div className="absolute -top-2 -right-2 w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
                      <Star className="w-5 h-5 text-yellow-800" />
                    </div>
                  </div>
                  <h1 className="text-4xl font-bold text-gray-900 mb-4">Premium Access</h1>
                  <p className="text-gray-600 text-lg mb-6">
                    Unlock exclusive access to the {oppositeGender} feed
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mb-8 p-6 bg-red-50 border border-red-200 rounded-xl shadow-lg" role="alert">
                    <div className="flex items-center">
                      <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                      <span className="text-red-700 text-sm">{error}</span>
                    </div>
                  </div>
                )}

                {/* Features List */}
                <div className="mb-10">
                  <h3 className="text-xl font-bold text-gray-900 mb-6">What you get:</h3>
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-4">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <span className="text-gray-800 font-medium">Access to {oppositeGender} user posts</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-4">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <span className="text-gray-800 font-medium">Flag and comment on posts</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-4">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <span className="text-gray-800 font-medium">3 full days of unlimited access</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-4">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <span className="text-gray-800 font-medium">No recurring charges</span>
                    </div>
                  </div>
                </div>

                {/* Pricing */}
                <div className="bg-gradient-to-r from-[#E0A3A3] to-[#D98B8B] bg-opacity-10 rounded-2xl p-8 mb-8 border border-[#E0A3A3] border-opacity-20">
                  <div className="text-center">
                    <div className="text-5xl font-black text-gray-900 mb-3">$29.99</div>
                    <div className="text-gray-700 text-lg font-medium mb-4">One-time payment • 3-day access</div>
                    <div className="flex items-center justify-center text-gray-600">
                      <Clock className="w-4 h-4 mr-1" />
                      <span>Access expires automatically</span>
                    </div>
                  </div>
                </div>

                {/* Payment Button */}
                <button
                  onClick={() => setShowPaymentForm(true)}
                  className="w-full py-5 px-8 rounded-2xl font-bold text-xl transition-all duration-300 bg-gradient-to-r from-[#E0A3A3] to-[#D98B8B] hover:from-[#D98B8B] hover:to-[#D17A7A] text-white shadow-2xl hover:shadow-3xl transform hover:scale-105"
                >
                  <div className="flex items-center justify-center">
                    <CreditCard className="w-7 h-7 mr-3" />
                    Unlock 3-Day Access
                  </div>
                </button>

                {/* Security Notice */}
                <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-blue-800 text-center font-medium">
                    <strong>🔒 Secure Payment:</strong> Powered by Stripe. Your payment information is encrypted and secure.
                  </p>
                </div>

                {/* Terms */}
                <div className="mt-6 text-center">
                  <p className="text-xs text-gray-500">
                    By purchasing, you agree to our terms of service. Access is non-refundable and expires after 3 days.
                  </p>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      </StripeProvider>
    );
  }

  // Main feed content (same as GenderFeed but for opposite gender)
  if (currentUser && hasAccess) {
    const oppositeGender = currentUser.gender === 'Male' ? 'Female' : 'Male';
    
    return (
      <div>
        <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-16 h-16 bg-gradient-to-br from-[#E0A3A3] to-[#D98B8B] rounded-2xl flex items-center justify-center mr-6 relative shadow-lg">
                  <Users className="w-8 h-8 text-white" />
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center shadow-md">
                    <Star className="w-4 h-4 text-yellow-800" />
                  </div>
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">Premium {oppositeGender} Feed</h1>
                  <p className="text-gray-600 text-lg">
                    Exclusive posts from {oppositeGender} users • @{currentUser.username}
                  </p>
                </div>
              </div>
              <div className="relative group hidden md:block">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center cursor-help">
                  <Info className="w-5 h-5 text-[#E0A3A3]" />
                </div>
                <div className="absolute right-0 top-12 w-72 bg-gray-900 text-white text-sm rounded-xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-10 shadow-2xl">
                  Premium access to {oppositeGender} posts. 
                  {paymentRecord && (
                    <span className="block mt-1 text-xs text-gray-300">
                      Expires: {new Date(paymentRecord.expires_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Access Status */}
          {paymentRecord && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-8 shadow-lg">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-4">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <span className="text-green-800 font-bold text-lg">Premium Access Active</span>
                  <p className="text-green-700 text-sm mt-1 font-medium">
                    Expires: {new Date(paymentRecord.expires_at).toLocaleDateString()} at {new Date(paymentRecord.expires_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8 shadow-lg" role="alert">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                <span className="text-red-700 text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-[#E0A3A3] to-[#D98B8B] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
                <p className="text-gray-700 text-lg font-medium">Loading premium content...</p>
                <p className="text-gray-500 text-sm mt-2">Accessing exclusive {oppositeGender} posts</p>
              </div>
            </div>
          ) : posts.length === 0 ? (
            /* Empty State */
            <div className="bg-white rounded-2xl shadow-xl p-16 text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-[#E0A3A3] to-[#D98B8B] rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg">
                <Heart className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">No premium posts yet!</h3>
              <p className="text-gray-600 text-lg mb-8 max-w-md mx-auto">
                Be patient, {oppositeGender} users will start sharing content soon.
              </p>
              <button
                onClick={() => navigate('/feed')}
                className="px-8 py-4 bg-gradient-to-r from-[#E0A3A3] to-[#D98B8B] hover:from-[#D98B8B] hover:to-[#D17A7A] text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
              >
                Visit your feed
              </button>
            </div>
          ) : (
            /* Posts Feed - Same structure as GenderFeed */
            <div className="space-y-8">
              {posts.map((post) => (
                <div key={post.id} className="bg-white rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] border-2 border-[#E0A3A3] border-opacity-20">
                  {/* Post Header */}
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-gradient-to-br from-[#E0A3A3] to-[#D98B8B] rounded-xl flex items-center justify-center mr-4 shadow-md">
                          <span className="text-white font-bold text-lg">
                            {post.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-lg">@{post.username}</p>
                          <div className="flex items-center">
                            <p className="text-sm text-gray-500 font-medium mr-2">{post.gender}</p>
                            <Star className="w-4 h-4 text-yellow-500" />
                          </div>
                        </div>
                      </div>
                      <span className="text-sm text-gray-500 font-medium">
                        {new Date(post.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Post Image */}
                  <div className="relative">
                    <img
                      src={post.photo_url}
                      alt={`Premium photo shared by @${post.username}`}
                      className="w-full h-96 object-cover"
                    />
                    <div className="absolute top-6 right-6 bg-gradient-to-r from-[#E0A3A3] to-[#D98B8B] text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                      Premium
                    </div>
                  </div>

                  {/* Post Actions */}
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-6">
                        {/* Green Flag Button */}
                        <button
                          onClick={() => handleFlag(post.id, 'green')}
                          disabled={flaggingPostId === post.id}
                          aria-label={`Give this post a green flag (${post.green_flag_count} so far)`}
                          className="flex items-center space-x-3 px-4 py-3 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl transition-all duration-200 disabled:opacity-50 shadow-md hover:shadow-lg transform hover:scale-105"
                        >
                          {flaggingPostId === post.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                          ) : (
                            <CheckCircle className="w-5 h-5" aria-hidden="true" />
                          )}
                          <span className="text-lg font-bold">{post.green_flag_count}</span>
                        </button>

                        {/* Red Flag Button */}
                        <button
                          onClick={() => handleFlag(post.id, 'red')}
                          disabled={flaggingPostId === post.id}
                          aria-label={`Give this post a red flag (${post.red_flag_count} so far)`}
                          className="flex items-center space-x-3 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl transition-all duration-200 disabled:opacity-50 shadow-md hover:shadow-lg transform hover:scale-105"
                        >
                          {flaggingPostId === post.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                          ) : (
                            <XCircle className="w-5 h-5" aria-hidden="true" />
                          )}
                          <span className="text-lg font-bold">{post.red_flag_count}</span>
                        </button>
                      </div>

                      {/* Comment Button */}
                      <button
                        onClick={() => openCommentModal(post.id)}
                        className="flex items-center space-x-3 px-6 py-3 bg-gradient-to-r from-[#E0A3A3] to-[#D98B8B] hover:from-[#D98B8B] hover:to-[#D17A7A] text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold"
                      >
                        <MessageSquare className="w-5 h-5" />
                        <span>Add Comment</span>
                      </button>
                    </div>

                    {/* Comments Section */}
                    {post.comments && post.comments.length > 0 && (
                      <div className="border-t border-gray-100 pt-6">
                        <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                          <MessageSquare className="w-5 h-5 mr-2" />
                          Comments ({post.comments.length})
                        </h4>
                        <div className="space-y-4">
                          {post.comments.map((comment) => (
                            <div key={comment.id} className="bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-colors duration-200">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                  <div className="w-8 h-8 bg-gradient-to-br from-[#E0A3A3] to-[#D98B8B] rounded-lg flex items-center justify-center">
                                    <span className="text-white font-bold text-xs">
                                      {comment.username.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <span className="text-sm font-bold text-gray-900">
                                    @{comment.username}
                                  </span>
                                  <span className="text-xs text-gray-600 bg-white px-3 py-1 rounded-full font-medium shadow-sm">
                                    {comment.gender}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500 font-medium">
                                  {new Date(comment.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-gray-800 leading-relaxed ml-10">{comment.content}</p>
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

          {/* Comment Modal - Same as GenderFeed */}
          {isCommentModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full transform transition-all duration-300">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <h3 className="text-xl font-bold text-gray-900">Add Anonymous Comment</h3>
                  <button
                    onClick={closeCommentModal}
                    className="w-8 h-8 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full flex items-center justify-center transition-colors duration-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="p-6">
                  <div className="mb-6">
                    <p className="text-gray-600 mb-3">
                      Commenting as: <span className="font-medium">@{currentUser?.username}</span>
                      <span className="ml-3 text-sm bg-gradient-to-r from-[#E0A3A3] to-[#D98B8B] text-white px-3 py-1 rounded-full font-medium">
                        {currentUser?.gender}
                      </span>
                    </p>
                    <div className="rounded-xl border border-[#E0A3A3]/50 bg-[#FFF7F8] p-4 text-sm leading-6 text-gray-700">
                      {anonymousComposerHelperText}
                    </div>
                  </div>
                  
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Share your thoughts..."
                    className="w-full h-32 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E0A3A3] focus:border-transparent resize-none text-gray-800 placeholder-gray-500"
                    maxLength={500}
                  />
                  
                  <div className="flex items-center justify-between mt-6">
                    <span className="text-sm text-gray-500 font-medium">
                      {commentText.length}/500 characters
                    </span>
                    <div className="flex space-x-3">
                      <button
                        onClick={closeCommentModal}
                        className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSubmitComment}
                        disabled={!commentText.trim() || submittingComment}
                        className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                          commentText.trim() && !submittingComment
                            ? 'bg-gradient-to-r from-[#E0A3A3] to-[#D98B8B] hover:from-[#D98B8B] hover:to-[#D17A7A] text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {submittingComment ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Send className="w-5 h-5" />
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
        </div>
      </div>
    );
  }

  return null;
}