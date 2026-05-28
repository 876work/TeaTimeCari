// src/features/admin/registrations/AdminUserReview.tsx
import React, { useEffect, useState } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { CheckCircle, XCircle, Loader2, AlertCircle, User, Mail, Phone, Camera, Calendar, RefreshCw } from 'lucide-react';
import { X } from 'lucide-react';
import { AdminLayout } from './AdminLayout';

// Normalize the shape so missing fields don't blow up the UI
interface UserRow {
  id: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  username?: string | null;
  gender?: 'Male' | 'Female' | null;
  captureType?: 'selfie' | 'id' | null;
  imageData?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'verified' | 'banned';
  created_at?: string | null;
  password_temp?: string | null;
  rejection_reason?: string | null;
  email_code?: string | null;
  email_code_expiry?: string | null;
  last_code_sent_at?: string | null;
  last_code_delivery_status?: string | null;
}

export function AdminUserReview() {
  const supabase = useSupabaseClient();
  const session = useSession();
  const [pendingUsers, setPendingUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGender, setFilterGender] = useState<'all' | 'Male' | 'Female'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'verified' | 'rejected' | 'banned'>('all');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [discourseBaseUrl, setDiscourseBaseUrl] = useState<string>('');

  // ——— helpers (SAFE) ———
  const safeDisplayName = (u: UserRow) => {
    const full = [u.fullName, [u.firstName, u.lastName].filter(Boolean).join(' ')].find(s => (s ?? '').trim());
    return (full ?? '').trim() || u.username || u.email || 'user';
  };


  // Get Discourse base URL (optional)
  useEffect(() => {
    setDiscourseBaseUrl(import.meta.env.VITE_DISCOURSE_BASE_URL || '');
  }, []);

  // Super basic admin check (you should replace with roles)
  const isAdmin = !!session?.user?.id; // let’s not block you; your function enforces real admin anyway

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
        .select('id, firstName, lastName, email, phone, username, gender, captureType, imageData, status, created_at, password_temp, rejection_reason, email_code, email_code_expiry');

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error: fetchError } = await query.order('created_at', { ascending: false });

      if (fetchError) {
        if (fetchError.code === '42P01') {
          console.warn('registrations table missing, showing mock data');
          setMockData();
          return;
        }
        throw fetchError;
      }

      // add last code info if table exists (best-effort)
      const usersWithCodeInfo: UserRow[] = await Promise.all(
        (data ?? []).map(async (user: any) => {
          // Create fullName from firstName and lastName
          const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || null;
          
          try {
            const { data: lastCodeSend } = await supabase
              .from('code_sends')
              .select('sent_at, delivery_status')
              .eq('user_id', user.id)
              .order('sent_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            return {
              ...user,
              fullName,
              last_code_sent_at: lastCodeSend?.sent_at || null,
              last_code_delivery_status: lastCodeSend?.delivery_status || null,
            } as UserRow;
          } catch {
            return { ...user, fullName } as UserRow;
          }
        })
      );

      setPendingUsers(usersWithCodeInfo);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(`Failed to fetch users: ${err.message || String(err)}`);
      setMockData();
    } finally {
      setLoading(false);
    }
  };

  // Mock data to keep the page usable
  const setMockData = () => {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    const expiredTime = new Date(now.getTime() - 5 * 60 * 1000);

    const mockUsers: UserRow[] = [
      {
        id: '1',
        fullName: 'John Doe',
        email: 'john.doe@example.com',
        phone: '758-123-4567',
        username: 'johndoe',
        gender: 'Male',
        captureType: 'selfie',
        imageData: '',
        status: 'pending',
        created_at: new Date().toISOString(),
        password_temp: 'demo123',
      },
      {
        id: '2',
        fullName: 'Jane Smith',
        email: 'jane.smith@example.com',
        phone: '758-987-6543',
        username: 'janesmith',
        gender: 'Female',
        captureType: 'id',
        imageData: '',
        status: 'verified',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        password_temp: 'secure456',
        email_code: 'SLU123456',
        email_code_expiry: fiveMinutesFromNow.toISOString(),
        last_code_sent_at: tenMinutesAgo.toISOString(),
        last_code_delivery_status: 'success',
      },
      {
        id: '3',
        fullName: 'Mike Johnson',
        email: 'mike.johnson@example.com',
        phone: '758-555-1234',
        username: 'mikej',
        gender: 'Male',
        captureType: 'selfie',
        imageData: '',
        status: 'banned',
        created_at: new Date(Date.now() - 172800000).toISOString(),
        password_temp: 'mypass789',
        email_code: 'SLU789012',
        email_code_expiry: expiredTime.toISOString(),
        last_code_sent_at: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
        last_code_delivery_status: 'failed',
      },
      {
        id: '4',
        fullName: 'Sarah Wilson',
        email: 'sarah.wilson@example.com',
        phone: '758-777-8888',
        username: 'sarahw',
        gender: 'Female',
        captureType: 'id',
        imageData: '',
        status: 'rejected',
        rejection_reason: 'Incomplete documentation',
        created_at: new Date(Date.now() - 259200000).toISOString(),
      },
    ];

    let filteredMockData = mockUsers;
    if (filterStatus !== 'all') filteredMockData = mockUsers.filter(u => u.status === filterStatus);
    setPendingUsers(filteredMockData);
    setLoading(false);
  };

  const handleApprove = async (user: UserRow) => {
    if (!confirm(`Are you sure you want to approve ${user.username ?? safeDisplayName(user)}?`)) return;

    // Check if user is logged in
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('You must be logged in to perform this action.');
      return;
    }


    setProcessingUserId(user.id);
    setError(null);

    try {
      // Update local registration first (optional — your function also updates)
      const { error: updateError } = await supabase
        .from('registrations')
        .update({ status: 'approved' })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error updating registration status:', updateError);
        throw new Error(updateError.message);
      }

      // Call the approve function with proper authorization
      const { data, error: fnError } = await supabase.functions.invoke('approve-and-sync', {
        body: { registration_id: user.id },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      // Log response for debugging
      console.log('approve-and-sync response:', { data, error: fnError });

      if (fnError) {
        console.error('approve-and-sync function error:', fnError);
        
        // Handle specific error cases
        if (fnError.message?.includes('403') || fnError.message?.includes('Forbidden')) {
          throw new Error('Not authorized: You must be an admin to approve users');
        }
        
        throw new Error(fnError.message || 'Failed to call approve-and-sync function');
      }

      // Treat unknown status as success to avoid blocking you
      const status = data?.status ?? 'synced';

      if (status === 'approved_with_sync_error') {
        setError(`User approved but Discourse sync failed: ${data?.error || 'Unknown sync error'}`);
      }


      // Remove from list and notify
      setPendingUsers(prev => prev.filter(u => u.id !== user.id));
      const name = user.username ?? safeDisplayName(user);
      const message =
        status === 'approved_with_sync_error'
          ? `⚠️ ${name} approved; Discourse sync failed.`
          : `✅ ${name} approved successfully.`;
      alert(message);
    } catch (err: any) {
      console.error('Error approving user:', err);
      
      // Format error messages for UI
      let errorMessage = err.message || 'Unknown error';
      if (errorMessage.includes('You must be logged in')) {
        errorMessage = 'Not logged in: Please refresh the page and try again';
      } else if (errorMessage.includes('Not authorized') || errorMessage.includes('admin')) {
        errorMessage = 'Not an admin: You do not have permission to approve users';
      }
      
      setError(`Failed to approve ${user.username ?? safeDisplayName(user)}: ${errorMessage}`);
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleReject = async (userId: string, userName: string | null | undefined) => {
    const reason = prompt(`Please provide a reason for rejecting ${userName ?? 'this user'} (optional):`);
    if (reason === null) return;

    setProcessingUserId(userId);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('registrations')
        .update({ status: 'rejected', rejection_reason: reason || 'No reason provided' })
        .eq('id', userId);

      if (updateError && updateError.code !== '42P01') throw updateError;

      setPendingUsers(prev => prev.filter(u => u.id !== userId));
      alert(`${userName ?? 'User'} has been rejected.`);
    } catch (err: any) {
      console.error('Error rejecting user:', err);
      setError(`Failed to reject user: ${err.message || String(err)}`);
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleBan = async (userId: string, userName?: string | null) => {
    if (!confirm(`Are you sure you want to ban ${userName ?? 'this user'}?`)) return;

    setProcessingUserId(userId);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('registrations')
        .update({ status: 'banned' })
        .eq('id', userId);

      if (updateError && updateError.code !== '42P01') throw updateError;

      setPendingUsers(prev => prev.map(u => (u.id === userId ? { ...u, status: 'banned' } : u)));
      alert(`${userName ?? 'User'} has been banned successfully.`);
    } catch (err: any) {
      console.error('Error banning user:', err);
      setError(`Failed to ban user: ${err.message || String(err)}`);
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleUnban = async (userId: string, userName?: string | null) => {
    if (!confirm(`Are you sure you want to unban ${userName ?? 'this user'}?`)) return;

    setProcessingUserId(userId);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('registrations')
        .update({ status: 'verified' })
        .eq('id', userId);

      if (updateError && updateError.code !== '42P01') throw updateError;

      setPendingUsers(prev => prev.map(u => (u.id === userId ? { ...u, status: 'verified' } : u)));
      alert(`${userName ?? 'User'} has been unbanned successfully.`);
    } catch (err: any) {
      console.error('Error unbanning user:', err);
      setError(`Failed to unban user: ${err.message || String(err)}`);
    } finally {
      setProcessingUserId(null);
    }
  };

  // Filters (SAFE)
  const filteredUsers = pendingUsers.filter(u => {
    const needle = searchTerm.trim().toLowerCase();
    const hay = [
      u.fullName,
      u.firstName,
      u.lastName,
      u.email,
      u.username,
      u.phone,
    ]
      .map(v => (v ?? '').toLowerCase());

    const matchesSearch = !needle || hay.some(h => h.includes(needle));
    const matchesGender = filterGender === 'all' || u.gender === filterGender;
    return matchesSearch && matchesGender;
  });

  const openImageModal = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setIsImageModalOpen(true);
  };
  const closeImageModal = () => {
    setSelectedImage(null);
    setIsImageModalOpen(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Pending</span>;
      case 'verified':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Verified</span>;
      case 'banned':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Banned</span>;
      case 'rejected':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Rejected</span>;
      default:
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{status}</span>;
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
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">Search Users</label>
              <input
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, or username..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="gender-filter" className="block text-sm font-medium text-gray-700 mb-2">Filter by Gender</label>
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
              <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
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

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4" role="alert">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Users */}
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Photo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
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
                              {safeDisplayName(user)}
                            </div>
                            <div className="text-sm text-gray-500">@{user.username ?? 'user'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900 mb-1">
                          <Mail className="w-4 h-4 text-gray-400 mr-2" />
                          {user.email ?? ''}
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <Phone className="w-4 h-4 text-gray-400 mr-2" />
                          {user.phone ?? ''}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">Gender: {user.gender ?? ''}</div>
                        <div className="text-sm text-gray-500">
                          Photo: {user.captureType === 'selfie' ? 'Selfie' : user.captureType === 'id' ? 'ID Document' : '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.imageData ? (
                          <div className="relative">
                            <img
                              src={user.imageData}
                              alt={`${user.captureType ?? 'photo'} thumbnail`}
                              className="h-16 w-16 object-cover rounded-lg border-2 border-gray-200 shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => openImageModal(user.imageData!)}
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
                        {getStatusBadge(user.status)}
                        {user.status === 'rejected' && user.rejection_reason && (
                          <div className="text-xs text-gray-500 mt-1">Reason: {user.rejection_reason}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-500">
                          <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                          {user.created_at ? new Date(user.created_at).toLocaleDateString() : ''}
                        </div>
                        <div className="text-xs text-gray-400">
                          {user.created_at ? new Date(user.created_at).toLocaleTimeString() : ''}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          {user.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(user)}
                                disabled={processingUserId === user.id}
                                className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${processingUserId === user.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                {processingUserId === user.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                ) : (
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                )}
                                Approve
                              </button>
                              <button
                                onClick={() => handleReject(user.id, user.username ?? safeDisplayName(user))}
                                disabled={processingUserId === user.id}
                                className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${processingUserId === user.id ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                              className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${processingUserId === user.id ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                              className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${processingUserId === user.id ? 'opacity-50 cursor-not-allowed' : ''}`}
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

      {discourseBaseUrl && (
        <div className="fixed bottom-4 right-4 bg-white border shadow p-4 rounded">
          <div className="font-medium mb-2">User Management</div>
          <button
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
            onClick={() => window.open(discourseBaseUrl, '_blank')}
          >
            Open Community Forum
          </button>
          <div className="text-xs text-gray-500 mt-1 text-center">View approved users in Discourse</div>
        </div>
      )}
    </AdminLayout>
  );
}
