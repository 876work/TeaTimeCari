import React, { useEffect, useState } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { 
  Trash2, 
  Eye, 
  UserX, 
  Loader2, 
  AlertCircle, 
  Flag, 
  Calendar, 
  Filter,
  RefreshCw,
  X,
  CheckCircle,
  AlertTriangle,
  Search
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';


function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const maybeError = error as { message?: unknown };
    if (typeof maybeError.message === 'string') return maybeError.message;
    return JSON.stringify(error);
  }
  return String(error);
}

// Type definitions
interface FlaggedPost {
  id: string;
  user_id: string;
  username: string;
  gender: 'Male' | 'Female';
  photo_url: string;
  green_flag_count: number;
  red_flag_count: number;
  created_at: string;
}

interface FilterState {
  gender: 'all' | 'Male' | 'Female';
  redFlagThreshold: number;
  dateFrom: string;
  dateTo: string;
  searchTerm: string;
}

export function ReviewFlaggedPosts({
  activePage = 'flagged-posts',
  onNavigate,
}: {
  activePage?: string;
  onNavigate?: (page: string) => void;
}) {
  const supabase = useSupabaseClient();
  const session = useSession();
  
  // State management
  const [flaggedPosts, setFlaggedPosts] = useState<FlaggedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingPostId, setProcessingPostId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  
  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    gender: 'all',
    redFlagThreshold: 1,
    dateFrom: '',
    dateTo: '',
    searchTerm: ''
  });

  // Simple admin check - in production, implement proper role-based access control
  const isAdmin = session?.user?.email?.includes('admin') || true; // TODO: Implement proper admin role check

  useEffect(() => {
    if (!isAdmin) {
      setError('Access Denied: You must be an administrator to view this page.');
      setLoading(false);
      return;
    }

    fetchFlaggedPosts();
  }, [isAdmin, supabase, filters]);

  const fetchFlaggedPosts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from('posts')
        .select('*')
        .gte('red_flag_count', filters.redFlagThreshold)
        .order('red_flag_count', { ascending: false });

      // Apply gender filter
      if (filters.gender !== 'all') {
        query = query.eq('gender', filters.gender);
      }

      // Apply date range filters
      if (filters.dateFrom) {
        query = query.gte('created_at', new Date(filters.dateFrom).toISOString());
      }
      if (filters.dateTo) {
        const endDate = new Date(filters.dateTo);
        endDate.setHours(23, 59, 59, 999); // End of day
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        // If table doesn't exist, show mock data for demonstration
        if (fetchError.code === '42P01') {
          console.warn('Posts table not found, using mock data');
          setMockData();
          return;
        }
        throw fetchError;
      }

      // Apply search filter on client side (for username search)
      let filteredData = data || [];
      if (filters.searchTerm) {
        filteredData = filteredData.filter(post =>
          post.username.toLowerCase().includes(filters.searchTerm.toLowerCase())
        );
      }

      setFlaggedPosts(filteredData);
    } catch (err: unknown) {
      console.error('Error fetching flagged posts:', err);
      setError(`Failed to fetch flagged posts: ${getErrorMessage(err)}`);
      // Fallback to mock data for demonstration
      setMockData();
    } finally {
      setLoading(false);
    }
  };

  // Mock data for demonstration
  const setMockData = () => {
    const mockPosts: FlaggedPost[] = [
      {
        id: '1',
        user_id: 'user-1',
        username: 'problematic_user',
        gender: 'Male',
        photo_url: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=400',
        green_flag_count: 2,
        red_flag_count: 15,
        created_at: new Date().toISOString()
      },
      {
        id: '2',
        user_id: 'user-2',
        username: 'flagged_content',
        gender: 'Female',
        photo_url: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=400',
        green_flag_count: 5,
        red_flag_count: 8,
        created_at: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: '3',
        user_id: 'user-3',
        username: 'reported_user',
        gender: 'Male',
        photo_url: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=400',
        green_flag_count: 1,
        red_flag_count: 3,
        created_at: new Date(Date.now() - 172800000).toISOString()
      }
    ];
    
    // Apply filters to mock data
    let filteredMockData = mockPosts.filter(post => post.red_flag_count >= filters.redFlagThreshold);
    
    if (filters.gender !== 'all') {
      filteredMockData = filteredMockData.filter(post => post.gender === filters.gender);
    }
    
    if (filters.searchTerm) {
      filteredMockData = filteredMockData.filter(post =>
        post.username.toLowerCase().includes(filters.searchTerm.toLowerCase())
      );
    }
    
    setFlaggedPosts(filteredMockData);
    setLoading(false);
  };

  const handleDeletePost = async (postId: string, photoUrl: string, username: string) => {
    if (!confirm(`Are you sure you want to delete the post by @${username}? This action cannot be undone.`)) {
      return;
    }

    setProcessingPostId(postId);
    setError(null);

    try {
      // Extract file path from photo URL for storage deletion
      const urlParts = photoUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const userId = urlParts[urlParts.length - 2];
      const filePath = `posts/${userId}/${fileName}`;

      // Delete from Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('posts')
        .remove([filePath]);

      if (storageError) {
        console.warn('Storage deletion failed:', storageError);
        // Continue with database deletion even if storage fails
      }

      // Delete from posts table
      const { error: deleteError } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (deleteError && deleteError.code !== '42P01') {
        throw deleteError;
      }

      // Remove from local state
      setFlaggedPosts(prev => prev.filter(post => post.id !== postId));
      
      alert(`Post by @${username} has been deleted successfully.`);

    } catch (err: unknown) {
      console.error('Error deleting post:', err);
      setError(`Failed to delete post: ${getErrorMessage(err)}`);
    } finally {
      setProcessingPostId(null);
    }
  };

  const handleBanUser = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to ban @${username}? This will prevent them from accessing the platform.`)) {
      return;
    }

    setProcessingPostId(userId);
    setError(null);

    try {
      // Update user status to banned in registrations table
      const { error: banError } = await supabase
        .from('registrations')
        .update({ status: 'banned' })
        .eq('id', userId);

      if (banError && banError.code !== '42P01') {
        throw banError;
      }

      // Optional: Log moderation action (if moderation_logs table exists)
      try {
        await supabase
          .from('moderation_logs')
          .insert([{
            admin_id: session?.user?.id,
            action: 'ban_user',
            target_user_id: userId,
            reason: 'Banned via flagged posts review',
            created_at: new Date().toISOString()
          }]);
      } catch (logError) {
        console.warn('Failed to log moderation action:', logError);
        // Don't fail the ban if logging fails
      }

      // Remove all posts by this user from the current view
      setFlaggedPosts(prev => prev.filter(post => post.user_id !== userId));
      
      alert(`User @${username} has been banned successfully.`);

    } catch (err: unknown) {
      console.error('Error banning user:', err);
      setError(`Failed to ban user: ${getErrorMessage(err)}`);
    } finally {
      setProcessingPostId(null);
    }
  };

  const openImageModal = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setIsImageModalOpen(true);
  };

  const closeImageModal = () => {
    setSelectedImage(null);
    setIsImageModalOpen(false);
  };

  const handleFilterChange = (key: keyof FilterState, value: string | number) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      gender: 'all',
      redFlagThreshold: 1,
      dateFrom: '',
      dateTo: '',
      searchTerm: ''
    });
  };

  if (!isAdmin) {
    return (
      <AdminLayout activePage={activePage} onNavigate={onNavigate}>
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-700">You do not have administrative privileges to view this page.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Review Flagged Posts</h2>
              <p className="text-gray-600 mt-1">Moderate posts with high red flag counts</p>
            </div>
            <button
              onClick={fetchFlaggedPosts}
              disabled={loading}
              className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Filter className="w-5 h-5 mr-2" />
              Filters
            </h3>
            <button
              onClick={resetFilters}
              className="text-sm text-gray-600 hover:text-gray-800 underline"
            >
              Reset Filters
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                Search Username
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  id="search"
                  value={filters.searchTerm}
                  onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                  placeholder="Search by username..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Gender Filter */}
            <div>
              <label htmlFor="gender-filter" className="block text-sm font-medium text-gray-700 mb-2">
                Gender
              </label>
              <select
                id="gender-filter"
                value={filters.gender}
                onChange={(e) => handleFilterChange('gender', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            {/* Red Flag Threshold */}
            <div>
              <label htmlFor="threshold" className="block text-sm font-medium text-gray-700 mb-2">
                Min Red Flags
              </label>
              <input
                type="number"
                id="threshold"
                min="1"
                value={filters.redFlagThreshold}
                onChange={(e) => handleFilterChange('redFlagThreshold', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Date From */}
            <div>
              <label htmlFor="date-from" className="block text-sm font-medium text-gray-700 mb-2">
                From Date
              </label>
              <input
                type="date"
                id="date-from"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Date To */}
            <div>
              <label htmlFor="date-to" className="block text-sm font-medium text-gray-700 mb-2">
                To Date
              </label>
              <input
                type="date"
                id="date-to"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4" role="alert">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Posts Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mr-3" />
              <p className="text-gray-600">Loading flagged posts...</p>
            </div>
          ) : flaggedPosts.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium">No flagged posts found!</p>
              <p className="text-sm text-gray-500 mt-2">
                {filters.redFlagThreshold > 1 || filters.gender !== 'all' || filters.searchTerm || filters.dateFrom || filters.dateTo
                  ? 'Try adjusting your filters to see more results.'
                  : 'All posts are within acceptable flag limits.'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Post
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Flags
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Posted
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {flaggedPosts.map((post) => (
                    <tr key={post.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="relative">
                            <img
                              src={post.photo_url}
                              alt="Post thumbnail"
                              className="h-16 w-16 object-cover rounded-lg border-2 border-gray-200 shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => openImageModal(post.photo_url)}
                            />
                            {post.red_flag_count > 10 && (
                              <div className="absolute -top-2 -right-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                                HIGH RISK
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">@{post.username}</div>
                          <div className="text-sm text-gray-500">{post.gender}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center">
                            <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                            <span className="text-sm font-medium text-green-700">{post.green_flag_count}</span>
                          </div>
                          <div className="flex items-center">
                            <Flag className="w-4 h-4 text-red-500 mr-1" />
                            <span className={`text-sm font-medium ${
                              post.red_flag_count > 10 ? 'text-red-700 font-bold' : 'text-red-600'
                            }`}>
                              {post.red_flag_count}
                            </span>
                          </div>
                        </div>
                        {post.red_flag_count > 10 && (
                          <div className="mt-1">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              High Risk
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-500">
                          <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                          {new Date(post.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(post.created_at).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => openImageModal(post.photo_url)}
                            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            title="View full image"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePost(post.id, post.photo_url, post.username)}
                            disabled={processingPostId === post.id}
                            className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${
                              processingPostId === post.id ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            title="Delete post"
                          >
                            {processingPostId === post.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleBanUser(post.user_id, post.username)}
                            disabled={processingPostId === post.user_id}
                            className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 ${
                              processingPostId === post.user_id ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            title="Ban user"
                          >
                            {processingPostId === post.user_id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <UserX className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Stats */}
        {flaggedPosts.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-gray-900">{flaggedPosts.length}</div>
                <div className="text-sm text-gray-600">Flagged Posts</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {flaggedPosts.filter(post => post.red_flag_count > 10).length}
                </div>
                <div className="text-sm text-gray-600">High Risk Posts</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-600">
                  {Math.round(flaggedPosts.reduce((sum, post) => sum + post.red_flag_count, 0) / flaggedPosts.length)}
                </div>
                <div className="text-sm text-gray-600">Avg Red Flags</div>
              </div>
            </div>
          </div>
        )}

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
                alt="Full size post"
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}