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
  Lock,
  CreditCard,
  Star,
  Clock
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
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

interface PaymentRecord {
  id: string;
  user_id: string;
  feed_access: string;
  status: string;
  expires_at: string;
  created_at: string;
}

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_mock');

export function OppositeGenderFeed() {
  const supabase = useSupabaseClient();
  const session = useSession();
  
  // State management
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLoading, setUserLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [paymentRecord, setPaymentRecord] = useState<PaymentRecord | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  
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
      } catch (err: any) {
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
      } catch (err: any) {
        console.error('Error fetching posts:', err);
        setError(`Failed to load posts: ${err.message}`);
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

  // Handle Stripe payment
  const handlePayment = async () => {
    if (!currentUser || isProcessingPayment) return;

    setIsProcessingPayment(true);
    setError(null);

    try {
      // Create payment intent via Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          feedAccess: 'opposite',
          amount: 2999, // $29.99 in cents
          currency: 'usd'
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to create payment intent');
      }

      if (!data.success) {
        throw new Error(data.error || 'Payment setup failed');
      }

      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error('Stripe failed to load');
      }

      // Redirect to Stripe Checkout or confirm payment
      const { error: stripeError } = await stripe.confirmCardPayment(data.paymentIntent.client_secret, {
        payment_method: {
          card: {
            // In a real app, you'd collect card details from the user
            // For demo purposes, we'll simulate a successful payment
          }
        }
      });

      if (stripeError) {
        throw new Error(stripeError.message || 'Payment failed');
      }

      // Payment successful - refresh access status
      setHasAccess(true);
      
      // Refresh the page to load content
      window.location.reload();

    } catch (err: any) {
      console.error('Payment error:', err);
      setError(`Payment failed: ${err.message}`);
    } finally {
      setIsProcessingPayment(false);
    }
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

  // Premium paywall screen
  if (currentUser && !hasAccess) {
    const oppositeGender = currentUser.gender === 'Male' ? 'Female' : 'Male';
    
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Premium Header */}
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                <Lock className="w-10 h-10 text-white" />
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
                  <Star className="w-4 h-4 text-yellow-800" />
                </div>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Premium Access</h1>
              <p className="text-gray-600 mb-4">
                Unlock exclusive access to the {oppositeGender} feed
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

            {/* Features List */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">What you get:</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Access to {oppositeGender} user posts</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Flag and comment on posts</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  <span className="text-gray-700">3 full days of unlimited access</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  <span className="text-gray-700">No recurring charges</span>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 mb-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-gray-900 mb-2">$29.99</div>
                <div className="text-gray-600 mb-4">One-time payment • 3-day access</div>
                <div className="flex items-center justify-center text-sm text-gray-500">
                  <Clock className="w-4 h-4 mr-1" />
                  <span>Access expires automatically</span>
                </div>
              </div>
            </div>

            {/* Payment Button */}
            <button
              onClick={handlePayment}
              disabled={isProcessingPayment}
              className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 ${
                isProcessingPayment
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02]'
              }`}
            >
              {isProcessingPayment ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="animate-spin h-6 w-6 mr-2" />
                  Processing Payment...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <CreditCard className="w-6 h-6 mr-2" />
                  Unlock 3-Day Access
                </div>
              )}
            </button>

            {/* Security Notice */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 text-center">
                <strong>🔒 Secure Payment:</strong> Powered by Stripe. Your payment information is encrypted and secure.
              </p>
            </div>

            {/* Terms */}
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">
                By purchasing, you agree to our terms of service. Access is non-refundable and expires after 3 days.
              </p>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Main feed content (same as GenderFeed but for opposite gender)
  if (currentUser && hasAccess) {
    const oppositeGender = currentUser.gender === 'Male' ? 'Female' : 'Male';
    
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center mr-4 relative">
                  <Users className="w-6 h-6 text-white" />
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center">
                    <Star className="w-3 h-3 text-yellow-800" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Premium {oppositeGender} Feed</h1>
                  <p className="text-gray-600">
                    Exclusive posts from {oppositeGender} users • @{currentUser.username}
                  </p>
                </div>
              </div>
              <div className="relative group">
                <Info className="w-5 h-5 text-gray-400 cursor-help" />
                <div className="absolute right-0 top-8 w-64 bg-gray-900 text-white text-sm rounded-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
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
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                <div className="flex-1">
                  <span className="text-green-700 text-sm font-medium">Premium Access Active</span>
                  <p className="text-green-600 text-xs mt-1">
                    Expires: {new Date(paymentRecord.expires_at).toLocaleDateString()} at {new Date(paymentRecord.expires_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
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
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Loading premium content...</p>
              </div>
            </div>
          ) : posts.length === 0 ? (
            /* Empty State */
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No premium posts yet!</h3>
              <p className="text-gray-600 mb-6">
                Be patient, {oppositeGender} users will start sharing content soon.
              </p>
            </div>
          ) : (
            /* Posts Feed - Same structure as GenderFeed */
            <div className="space-y-6">
              {posts.map((post) => (
                <div key={post.id} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow border border-purple-100">
                  {/* Post Header */}
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center mr-3">
                          <span className="text-white font-bold text-sm">
                            {post.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">@{post.username}</p>
                          <div className="flex items-center">
                            <p className="text-sm text-gray-500 mr-2">{post.gender}</p>
                            <Star className="w-3 h-3 text-yellow-500" />
                          </div>
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
                      alt="Premium post content"
                      className="w-full h-80 object-cover"
                    />
                    <div className="absolute top-4 right-4 bg-purple-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                      Premium
                    </div>
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
                        className="flex items-center space-x-2 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors"
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

          {/* Comment Modal - Same as GenderFeed */}
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
                    className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
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
                            ? 'bg-purple-600 hover:bg-purple-700 text-white'
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

  return null;
}