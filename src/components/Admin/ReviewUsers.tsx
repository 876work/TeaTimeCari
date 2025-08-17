import React, { useEffect, useState } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { createClient } from '@supabase/supabase-js';
import { CheckCircle, XCircle, Loader2, AlertCircle, User, Mail, Phone, Camera, Calendar, RefreshCw } from 'lucide-react';
import { X } from 'lucide-react';
import { AdminLayout } from './AdminLayout';

const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const FUNCTIONS_URL =
  import.meta.env.VITE_SUPABASE_FUNCTIONS_URL ??
  `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1`;
const fnClient = createClient(SUPABASE_URL, ANON, { functions: { url: FUNCTIONS_URL } });
const FN_HEADERS = { Authorization: `Bearer ${ANON}`, apikey: ANON, 'Content-Type': 'application/json' } as const;

// Define a type for the user data fetched from Supabase
interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  username: string;
  gender: 'Male' | 'Female';
  captureType: 'selfie' | 'id';
  imageData: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  rejection_reason?: string;
  email_code?: string | null;
  email_code_expiry?: string | null;
  last_code_sent_at?: string | null;
  last_code_delivery_status?: string | null;
}

export function AdminUserReview() {
  const supabase = useSupabaseClient();
  const session = useSession();
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGender, setFilterGender] = useState<'all' | 'Male' | 'Female'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'verified' | 'rejected' | 'banned'>('all');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [discourseBaseUrl, setDiscourseBaseUrl] = useState<string>('');

  // Get Discourse base URL from environment
  useEffect(() => {
    // In a real app, this would come from your environment
    // For demo purposes, we'll use a placeholder
    setDiscourseBaseUrl(import.meta.env.VITE_DISCOURSE_BASE_URL || 'https://forum.example.com');
  }, []);

  // Simple admin check - in production, implement proper role-based access control
  const isAdmin = session?.user?.email?.includes('admin'); // TODO: Implement proper admin role check

  useEffect(() => {
    if (!isAdmin) {
      setError('Access Denied: You must be an administrator to view this page.');
      setLoading(false);
      return;
    }

    fetchUsers();
  }, [isAdmin, supabase, filterStatus]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('registrations')
        .select('*, email_code, email_code_expiry');
      
      // Apply status filter if not 'all'
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }
      
      const { data, error: fetchError } = await query
        .order('created_at', { ascending: false });

      if (fetchError) {
        // If table doesn't exist, show mock data for demonstration
        if (fetchError.code === '42P01') {
          console.warn('Registrations table not found, using mock data');
          setMockData();
          return;
        }
        throw fetchError;
      }

      // Fetch last code send information for each user
      const usersWithCodeInfo = await Promise.all(
        (data || []).map(async (user) => {
          try {
            // Get the latest code send for this user
            const { data: lastCodeSend, error: codeSendError } = await supabase
              .from('code_sends')
              .select('sent_at, delivery_status')
              .eq('user_id', user.id)
              .order('sent_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (codeSendError && codeSendError.code !== 'PGRST116' && codeSendError.code !== '42P01') {
              console.warn('Error fetching code send data for user:', user.id, codeSendError);
            }

            return {
              ...user,
              last_code_sent_at: lastCodeSend?.sent_at || null,
              last_code_delivery_status: lastCodeSend?.delivery_status || null
            };
          } catch (err) {
            console.warn('Error processing code send data for user:', user.id, err);
            return {
              ...user,
              last_code_sent_at: null,
              last_code_delivery_status: null
            };
          }
        })
      );

      setPendingUsers(usersWithCodeInfo);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(`Failed to fetch users: ${err.message || err.toString()}`);
      // Fallback to mock data for demonstration
      setMockData();
    } finally {
      setLoading(false);
    }
  };

  // Mock data for demonstration purposes
  const setMockData = () => {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    const expiredTime = new Date(now.getTime() - 5 * 60 * 1000);

    const mockUsers: User[] = [
      {
        id: '1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '758-123-4567',
        username: 'johndoe',
        gender: 'Male',
        captureType: 'selfie',
        imageData: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMzIiIGZpbGw9IiNGM0Y0RjYiLz4KPHN2ZyB4PSIxNiIgeT0iMTYiIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2QjczODAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj4KPHBhdGggZD0iTTIwIDIxdi0yYTQgNCAwIDAgMC00LTRIOGE0IDQgMCAwIDAtNCA0djIiLz4KPGNpcmNsZSBjeD0iMTIiIGN5PSI3IiByPSI0Ii8+Cjwvc3ZnPgo8L3N2Zz4K',
        status: 'pending',
        created_at: new Date().toISOString(),
        email_code: null,
        email_code_expiry: null,
        last_code_sent_at: null,
        last_code_delivery_status: null
      },
      {
        id: '2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        phone: '758-987-6543',
        username: 'janesmith',
        gender: 'Female',
        captureType: 'id',
        imageData: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iOCIgZmlsbD0iI0YzRjRGNiIvPgo8c3ZnIHg9IjE2IiB5PSIxNiIgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzZCNzM4MCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPgo8cmVjdCB4PSIyIiB5PSIzIiB3aWR0aD0iMjAiIGhlaWdodD0iMTQiIHJ4PSIyIiByeT0iMiIvPgo8bGluZSB4MT0iOCIgeTE9IjIxIiB4Mj0iMTYiIHkyPSIyMSIvPgo8bGluZSB4MT0iMTIiIHkxPSIxNyIgeDI9IjEyIiB5Mj0iMjEiLz4KPC9zdmc+Cjwvc3ZnPgo=',
        status: 'verified',
        created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        email_code: 'SLU123456',
        email_code_expiry: fiveMinutesFromNow.toISOString(),
        last_code_sent_at: tenMinutesAgo.toISOString(),
        last_code_delivery_status: 'success'
      },
      {
        id: '3',
        firstName: 'Mike',
        lastName: 'Johnson',
        email: 'mike.johnson@example.com',
        phone: '758-555-1234',
        username: 'mikej',
        gender: 'Male',
        captureType: 'selfie',
        imageData: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMzIiIGZpbGw9IiNGM0Y0RjYiLz4KPHN2ZyB4PSIxNiIgeT0iMTYiIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2QjczODAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj4KPHBhdGggZD0iTTIwIDIxdi0yYTQgNCAwIDAgMC00LTRIOGE0IDQgMCAwIDAtNCA0djIiLz4KPGNpcmNsZSBjeD0iMTIiIGN5PSI3IiByPSI0Ii8+Cjwvc3ZnPgo8L3N2Zz4K',
        status: 'banned',
        created_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
        email_code: 'SLU789012',
        email_code_expiry: expiredTime.toISOString(),
        last_code_sent_at: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
        last_code_delivery_status: 'failed'
      },
      {
        id: '4',
        firstName: 'Sarah',
        lastName: 'Wilson',
        email: 'sarah.wilson@example.com',
        phone: '758-777-8888',
        username: 'sarahw',
        gender: 'Female',
        captureType: 'id',
        imageData: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iOCIgZmlsbD0iI0YzRjRGNiIvPgo8c3ZnIHg9IjE2IiB5PSIxNiIgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzZCNzM4MCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPgo8cmVjdCB4PSIyIiB5PSIzIiB3aWR0aD0iMjAiIGhlaWdodD0iMTQiIHJ4PSIyIiByeT0iMiIvPgo8bGluZSB4MT0iOCIgeTE9IjIxIiB4Mj0iMTYiIHkyPSIyMSIvPgo8bGluZSB4MT0iMTIiIHkxPSIxNyIgeDI9IjEyIiB5Mj0iMjEiLz4KPC9zdmc+Cjwvc3ZnPgo=',
        status: 'rejected',
        rejection_reason: 'Incomplete documentation',
        created_at: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
        email_code: null,
        email_code_expiry: null,
        last_code_sent_at: null,
        last_code_delivery_status: null
      }
    ];
    
    // Apply status filter to mock data
    let filteredMockData = mockUsers;
    if (filterStatus !== 'all') {
      filteredMockData = mockUsers.filter(user => user.status === filterStatus);
    }
    
    setPendingUsers(filteredMockData);
    setLoading(false);
  };

  const handleApprove = async (user: User) => {
    if (!confirm(`Are you sure you want to approve ${user.username}?`)) return;

    // Simple gender mapping - in production, you might want a more sophisticated UI
    const genderMapping = user.gender === 'Male' ? 'men' : 'women';

    setProcessingUserId(user.id);
    setError(null);
    try {
      // Update registration status first
      await supabase.from('registrations').update({ status: 'approved' }).eq('id', user.id);

      // Call the new approve-and-sync function
      const res = await fnClient.functions.invoke('approve-and-sync', {
        headers: FN_HEADERS,
        body: {
          user_id: user.id,
          gender: genderMapping,
          xaccess: false // Default to false, can be made configurable later
        }
      });

      if (res.error) {
        // Try to pull status/body from the error's response
        // @ts-ignore
        const ctx = res.error?.context;
        let extra = '';
        try {
          if (ctx?.response) {
            const status = ctx.response.status;
            const text = await ctx.response.text();
            extra = ` [status=${status}] ${text}`;
          }
        } catch (e) {
          console.warn('Failed to parse error context response:', e);
        }
        console.error('approve-and-sync error:', res.error?.name, res.error?.message, extra);
        throw new Error(`Failed to approve user: ${res.error?.message || 'Edge error'}${extra}`);
      }

      if (!res.data || res.data.status === 'failed') {
        console.error('approve-and-sync non-success:', res.data);
        throw new Error(`Failed to approve user: ${res.data?.error || 'Unknown error'}`);
      }

      // Handle partial success (approved but Discourse sync failed)
      if (res.data.status === 'approved_with_sync_error') {
        setError(`User approved but Discourse sync failed: ${res.data.error}`);
      }

      // Send approval email with verification code
      const { data: emailData, error: emailError } = await fnClient.functions.invoke('send-approval-email', {
        headers: FN_HEADERS,
        body: { email: user.email, firstName: user.firstName }
      });

      if (emailError || !emailData?.success) {
        console.error('send-approval-email error:', emailError, emailData);
        setError(`User approved but email failed: ${emailError?.message || emailData?.error || 'Unknown error'}`);
      }

      // Remove approved user from the list
      setPendingUsers(prev => prev.filter(u => u.id !== user.id));

      // Show success message with Discourse link
      const successMessage = res.data.status === 'synced'
        ? `${user.username} has been approved and synced to Discourse successfully!`
        : `${user.username} has been approved but there was an issue with Discourse sync.`;

      alert(successMessage);

    } catch (err: any) {
      console.error('Error approving user:', err);
      setError(`Failed to approve user: ${err.message || err.toString()}`);
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleReject = async (userId: string, userName: string) => {
    const reason = prompt(`Please provide a reason for rejecting ${userName} (optional):`);
    if (reason === null) return; // User cancelled

    setProcessingUserId(userId);
    setError(null);
    try {
      // Update user status in database
      const { error: updateError } = await supabase
        .from('registrations')
        .update({ 
          status: 'rejected', 
          rejection_reason: reason || 'No reason provided' 
        })
        .eq('id', userId);

      if (updateError && updateError.code !== '42P01') {
        throw updateError;
      }

      // Remove rejected user from the list
      setPendingUsers(prev => prev.filter(user => user.id !== userId));
      
      // Show success message  
      alert(`${userName} has been rejected.`);

    } catch (err: any) {
      console.error('Error rejecting user:', err);
      setError(`Failed to reject user: ${err.message || err.toString()}`);
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleBan = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to ban ${userName}? This will prevent them from accessing the platform.`)) {
      return;
    }

    setProcessingUserId(userId);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('registrations')
        .update({ status: 'banned' })
        .eq('id', userId);

      if (updateError && updateError.code !== '42P01') {
        throw updateError;
      }

      // Update local state
      setPendingUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, status: 'banned' } : user
      ));
      
      alert(`${userName} has been banned successfully.`);

    } catch (err: any) {
      console.error('Error banning user:', err);
      setError(`Failed to ban user: ${err.message || err.toString()}`);
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleUnban = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to unban ${userName}? This will restore their access to the platform.`)) {
      return;
    }

    setProcessingUserId(userId);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('registrations')
        .update({ status: 'verified' })
        .eq('id', userId);

      if (updateError && updateError.code !== '42P01') {
        throw updateError;
      }

      // Update local state
      setPendingUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, status: 'verified' } : user
      ));
      
      alert(`${userName} has been unbanned successfully.`);

    } catch (err: any) {
      console.error('Error unbanning user:', err);
      setError(`Failed to unban user: ${err.message || err.toString()}`);
    } finally {
      setProcessingUserId(null);
    }
  };

  // Filter users based on search and gender filter
  const filteredUsers = pendingUsers.filter(user => {
    const matchesSearch = searchTerm === '' || 
      user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesGender = filterGender === 'all' || user.gender === filterGender;
    
    return matchesSearch && matchesGender;
  });

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Pending
          </span>
        );
      case 'verified':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Verified
          </span>
        );
      case 'banned':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Banned
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  if (!isAdmin) {
    return (
      <AdminLayout>
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-700">You do not have administrative privileges to view this page.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
              <p className="text-gray-600 mt-1">View and manage all user registrations</p>
            </div>
            <button
              onClick={fetchUsers}
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex-1">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                Search Users
              </label>
              <input
                type="text"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, or username..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="gender-filter" className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Gender
              </label>
              <select
                id="gender-filter"
                value={filterGender}
                onChange={(e) => setFilterGender(e.target.value as 'all' | 'Male' | 'Female')}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div>
              <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Status
              </label>
              <select
                id="status-filter"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'pending' | 'verified' | 'rejected' | 'banned')}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
                <option value="banned">Banned</option>
              </select>
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

        {/* Users List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mr-3" />
              <p className="text-gray-600">Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium">
                {pendingUsers.length === 0 ? 'No users found!' : 'No users match your search criteria.'}
              </p>
              {pendingUsers.length === 0 && (
                <p className="text-sm text-gray-500 mt-2">No user registrations found.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Photo
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email Code Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Submitted
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <User className="w-5 h-5 text-blue-600" />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.firstName} {user.lastName}
                            </div>
                            <div className="text-sm text-gray-500">@{user.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900 mb-1">
                          <Mail className="w-4 h-4 text-gray-400 mr-2" />
                          {user.email}
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <Phone className="w-4 h-4 text-gray-400 mr-2" />
                          {user.phone}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">Gender: {user.gender}</div>
                        <div className="text-sm text-gray-500">
                          Photo: {user.captureType === 'selfie' ? 'Selfie' : 'ID Document'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.imageData ? (
                          <div className="relative">
                            <img
                              src={user.imageData}
                              alt={`${user.captureType} thumbnail`}
                              className="h-16 w-16 object-cover rounded-lg border-2 border-gray-200 shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => openImageModal(user.imageData)}
                              title="Click to view full size"
                            />
                            <div className="absolute -top-1 -right-1 bg-blue-500 text-white p-1 rounded-full">
                              <Camera className="w-3 h-3" />
                            </div>
                          </div>
                        ) : (
                          <div className="h-16 w-16 bg-gray-100 rounded-lg flex items-center justify-center">
                            <span className="text-xs text-gray-400">No photo</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          {user.email_code ? (
                            <div className="space-y-1">
                              <div className="flex items-center">
                                <span className="text-gray-600 text-xs mr-2">Code:</span>
                                <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                  {user.email_code}
                                </span>
                              </div>
                              {user.email_code_expiry && (
                                <div className="flex items-center">
                                  <span className="text-gray-600 text-xs mr-2">Expires:</span>
                                  <span className={`text-xs font-medium ${
                                    new Date(user.email_code_expiry) < new Date()
                                      ? 'text-red-600 font-bold'
                                      : 'text-green-600'
                                  }`}>
                                    {new Date(user.email_code_expiry).toLocaleString()}
                                  </span>
                                </div>
                              )}
                              {user.last_code_sent_at && (
                                <div className="flex items-center">
                                  <span className="text-gray-600 text-xs mr-2">Last Sent:</span>
                                  <span className="text-xs text-gray-500">
                                    {new Date(user.last_code_sent_at).toLocaleString()}
                                  </span>
                                </div>
                              )}
                              {user.last_code_delivery_status && (
                                <div className="flex items-center">
                                  <span className="text-gray-600 text-xs mr-2">Status:</span>
                                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                    user.last_code_delivery_status === 'success'
                                      ? 'bg-green-100 text-green-800'
                                      : user.last_code_delivery_status === 'failed'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {user.last_code_delivery_status}
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500">
                              No code generated
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(user.status)}
                        {user.status === 'rejected' && user.rejection_reason && (
                          <div className="text-xs text-gray-500 mt-1">
                            Reason: {user.rejection_reason}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-500">
                          <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                          {new Date(user.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(user.created_at).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          {user.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(user)}
                                disabled={processingUserId === user.id}
                                className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
                                  processingUserId === user.id ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                              >
                                {processingUserId === user.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                ) : (
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                )}
                                Approve
                              </button>
                              <button
                                onClick={() => handleReject(user.id, user.username)}
                                disabled={processingUserId === user.id}
                                className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${
                                  processingUserId === user.id ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                              >
                                {processingUserId === user.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                ) : (
                                  <XCircle className="w-4 h-4 mr-1" />
                                )}
                                Reject
                              </button>
                            </>
                          )}
                          
                          {user.status === 'verified' && (
                            <button
                              onClick={() => handleBan(user.id, user.username)}
                              disabled={processingUserId === user.id}
                              className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${
                                processingUserId === user.id ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                            >
                              {processingUserId === user.id ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-1" />
                              ) : (
                                <XCircle className="w-4 h-4 mr-1" />
                              )}
                              Ban
                            </button>
                          )}
                          
                          {user.status === 'banned' && (
                            <button
                              onClick={() => handleUnban(user.id, user.username)}
                              disabled={processingUserId === user.id}
                              className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
                                processingUserId === user.id ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                            >
                              {processingUserId === user.id ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-1" />
                              ) : (
                                <CheckCircle className="w-4 h-4 mr-1" />
                              )}
                              Unban
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                alt="Full size registration photo"
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
          </div>
        )}

        {/* Stats */}
        {filteredUsers.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-center text-sm text-gray-600">
              Showing {filteredUsers.length} of {pendingUsers.length} total users
            </div>
          </div>
        )}
      </div>

      {/* Success Banner with Discourse Link */}
      {discourseBaseUrl && (
        <div className="fixed bottom-4 right-4 bg-white border shadow p-4 rounded">
          <div className="font-medium mb-2">User Management</div>
          <button 
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
            onClick={() => window.open(discourseBaseUrl, '_blank')}
          >
            Open Community Forum
          </button>
          <div className="text-xs text-gray-500 mt-1 text-center">
            View approved users in Discourse
          </div>
        </div>
      )}
    </AdminLayout>
  );
}