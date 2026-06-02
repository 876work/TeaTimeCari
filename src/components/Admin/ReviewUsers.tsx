// src/features/admin/registrations/AdminUserReview.tsx
import React, { useEffect, useState } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { CheckCircle, XCircle, Loader2, AlertCircle, User, Mail, Phone, Camera, Calendar, RefreshCw } from 'lucide-react';
import { X } from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { approveRegistration } from '@/features/admin/registrations/api/approveRegistration';

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
  registration_ip_address?: string | null;
  registration_ip_location?: string | null;
  registration_browser?: string | null;
  registration_device?: string | null;
  registration_operating_system?: string | null;
  registration_user_agent?: string | null;
  registration_tracked_at?: string | null;
  last_login_at?: string | null;
  last_login_ip_address?: string | null;
  last_login_ip_location?: string | null;
  last_login_browser?: string | null;
  last_login_device?: string | null;
  last_login_operating_system?: string | null;
  last_login_user_agent?: string | null;
  last_seen_at?: string | null;
}

type PresenceFilter = 'all' | 'online' | 'offline';
type SortBy = 'registration_desc' | 'registration_asc' | 'last_login_desc' | 'last_login_asc';

export function AdminUserReview() {
  const supabase = useSupabaseClient();
  const session = useSession();
  const [pendingUsers, setPendingUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGender, setFilterGender] = useState<'all' | 'Male' | 'Female'>('all');
  type StatusFilter = 'all' | UserRow['status'];
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [presenceFilter, setPresenceFilter] = useState<PresenceFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('registration_desc');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [discourseBaseUrl, setDiscourseBaseUrl] = useState<string>('');

  // ——— helpers (SAFE) ———
  const safeDisplayName = (u: UserRow) => {
    const full = [u.fullName, [u.firstName, u.lastName].filter(Boolean).join(' ')].find(s => (s ?? '').trim());
    return (full ?? '').trim() || u.username || u.email || 'user';
  };

  const getErrorMessage = (err: unknown) => err instanceof Error ? err.message : String(err);

  // Get Discourse base URL (optional)
  useEffect(() => {
    setDiscourseBaseUrl(import.meta.env.VITE_DISCOURSE_BASE_URL || '');
  }, []);

  const isAdmin = !!session?.user?.id;

  useEffect(() => {
    if (!isAdmin) {
      setError('Access Denied: You must be an administrator to view this page.');
      setLoading(false);
      return;
    }
    fetchUsers();
  }, [isAdmin, supabase]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (!currentSession?.access_token) {
        throw new Error('You must be logged in as an admin to view users.');
      }

      const { data, error: fetchError } = await supabase.functions.invoke('get-admin-users', {
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
      });

      if (fetchError) throw fetchError;
      if (!data?.ok) throw new Error(data?.error || 'Unable to load users.');

      const usersWithNames: UserRow[] = (data.users ?? []).map((user: UserRow) => ({
        ...user,
        fullName: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || null,
      }));

      setPendingUsers(usersWithNames);
    } catch (err: unknown) {
      console.error('Error fetching users:', err);
      setError(`Failed to fetch users: ${getErrorMessage(err)}`);
      setPendingUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (user: UserRow) => {
    if (!confirm(`Are you sure you want to approve ${user.username ?? safeDisplayName(user)}?`)) return;

    setProcessingUserId(user.id);
    setError(null);

    try {
      // Let the Edge Function perform the database approval with the service role.
      // The function approves Supabase first and treats Discourse/email failures as
      // non-fatal, so external integration issues do not leave users pending.
      const data = await approveRegistration(user.id);

      // Treat unknown status as success to avoid blocking you
      const status = data?.status ?? 'approved';

      if (status === 'approved_with_sync_error') {
        setError(`User approved but Discourse sync failed: ${data?.discourse?.error || 'Unknown sync error'}`);
      } else if (data?.discourse?.skipped) {
        console.warn('Discourse pre-sync skipped:', data.discourse);
      }

      // Remove from list and notify
      setPendingUsers(prev => prev.filter(u => u.id !== user.id));

      const name = user.username ?? safeDisplayName(user);
      const message =
        status === 'approved_with_sync_error'
          ? `⚠️ ${name} approved; Discourse sync failed.`
          : `✅ ${name} approved successfully.`;

      alert(message);
    } catch (err: unknown) {
      console.error('Error approving user:', err);

      // Format error messages for UI
      let errorMessage = getErrorMessage(err) || 'Unknown error';

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

  const handleReject = async (user: UserRow) => {
    const userName = user.username ?? safeDisplayName(user);
    const reason = prompt(`Please provide a reason for rejecting ${userName ?? 'this user'} (optional):`);

    if (reason === null) return;

    setProcessingUserId(user.id);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('You must be logged in to perform this action.');
      }

      const { data, error: fnError } = await supabase.functions.invoke('send-rejection-email', {
        body: {
          registration_id: user.id,
          email: user.email,
          firstName: user.firstName,
          fullName: user.fullName,
          reason: reason || undefined,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (fnError) throw fnError;

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to reject user');
      }

      setPendingUsers(prev => prev.filter(u => u.id !== user.id));
      alert(`${userName ?? 'User'} has been rejected.`);
    } catch (err: unknown) {
      console.error('Error rejecting user:', err);
      setError(`Failed to reject user: ${getErrorMessage(err)}`);
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
    } catch (err: unknown) {
      console.error('Error banning user:', err);
      setError(`Failed to ban user: ${getErrorMessage(err)}`);
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
    } catch (err: unknown) {
      console.error('Error unbanning user:', err);
      setError(`Failed to unban user: ${getErrorMessage(err)}`);
    } finally {
      setProcessingUserId(null);
    }
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
  };

  const isUserOnline = (user: UserRow) => {
    if (!user.last_seen_at) return false;
    const seenAt = new Date(user.last_seen_at).getTime();
    return Number.isFinite(seenAt) && Date.now() - seenAt <= 5 * 60 * 1000;
  };

  const getPresenceBadge = (user: UserRow) => {
    const online = isUserOnline(user);
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${online ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
        <span className={`w-2 h-2 rounded-full mr-1.5 ${online ? 'bg-green-500' : 'bg-gray-400'}`} />
        {online ? 'Online' : 'Offline'}
      </span>
    );
  };

  const trackingValue = (value?: string | null) => value?.trim() || '—';

  // Filters (SAFE)
  const filteredUsers = pendingUsers
    .filter(u => {
      const needle = searchTerm.trim().toLowerCase();
      const hay = [
        u.fullName,
        u.firstName,
        u.lastName,
        u.email,
        u.username,
        u.phone,
      ].map(v => (v ?? '').toLowerCase());

      const matchesSearch = !needle || hay.some(h => h.includes(needle));
      const matchesGender = filterGender === 'all' || u.gender === filterGender;
      const matchesStatus = filterStatus === 'all' || u.status === filterStatus;
      const matchesPresence = presenceFilter === 'all'
        || (presenceFilter === 'online' && isUserOnline(u))
        || (presenceFilter === 'offline' && !isUserOnline(u));

      return matchesSearch && matchesGender && matchesStatus && matchesPresence;
    })
    .sort((a, b) => {
      const dateValue = (value?: string | null) => value ? new Date(value).getTime() || 0 : 0;
      switch (sortBy) {
        case 'registration_asc':
          return dateValue(a.created_at) - dateValue(b.created_at);
        case 'last_login_desc':
          return dateValue(b.last_login_at) - dateValue(a.last_login_at);
        case 'last_login_asc':
          return dateValue(a.last_login_at) - dateValue(b.last_login_at);
        case 'registration_desc':
        default:
          return dateValue(b.created_at) - dateValue(a.created_at);
      }
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
      case 'approved':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Approved</span>;
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="flex-1">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                Search Users
              </label>
              <input
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, phone, or username..."
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
                onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
                <option value="banned">Banned</option>
              </select>
            </div>

            <div>
              <label htmlFor="presence-filter" className="block text-sm font-medium text-gray-700 mb-2">
                Online Status
              </label>
              <select
                id="presence-filter"
                value={presenceFilter}
                onChange={(e) => setPresenceFilter(e.target.value as PresenceFilter)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Users</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>
            </div>

            <div>
              <label htmlFor="sort-by" className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </label>
              <select
                id="sort-by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="registration_desc">Registration newest</option>
                <option value="registration_asc">Registration oldest</option>
                <option value="last_login_desc">Last login newest</option>
                <option value="last_login_asc">Last login oldest</option>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Registered
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Login
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Seen
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <React.Fragment key={user.id}>
                      <tr className="hover:bg-gray-50">
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
                            {trackingValue(user.email)}
                          </div>
                          <div className="flex items-center text-sm text-gray-500">
                            <Phone className="w-4 h-4 text-gray-400 mr-2" />
                            {trackingValue(user.phone)}
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="space-y-1">
                            {getStatusBadge(user.status)}
                            {getPresenceBadge(user)}
                          </div>
                          {user.status === 'rejected' && user.rejection_reason && (
                            <div className="text-xs text-gray-500 mt-1">
                              Reason: {user.rejection_reason}
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-500">
                            <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                            {formatDateTime(user.created_at)}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {trackingValue(user.registration_ip_location)}
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDateTime(user.last_login_at)}
                          <div className="text-xs text-gray-400 mt-1">
                            {trackingValue(user.last_login_ip_location)}
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDateTime(user.last_seen_at)}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => setExpandedUserId(expandedUserId === user.id ? null : user.id)}
                              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              {expandedUserId === user.id ? 'Hide Details' : 'View Details'}
                            </button>

                            {user.imageData && (
                              <button
                                onClick={() => openImageModal(user.imageData!)}
                                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                              >
                                <Camera className="w-4 h-4 mr-1" />
                                Photo
                              </button>
                            )}

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
                                  onClick={() => handleReject(user)}
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

                      {expandedUserId === user.id && (
                        <tr className="bg-gray-50">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-sm">
                              <div className="bg-white rounded-lg border border-gray-200 p-4">
                                <h3 className="font-semibold text-gray-900 mb-3">Registration Tracking</h3>
                                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div><dt className="text-gray-500">Timestamp</dt><dd>{formatDateTime(user.created_at)}</dd></div>
                                  <div><dt className="text-gray-500">IP Address</dt><dd>{trackingValue(user.registration_ip_address)}</dd></div>
                                  <div><dt className="text-gray-500">Location</dt><dd>{trackingValue(user.registration_ip_location)}</dd></div>
                                  <div><dt className="text-gray-500">Browser</dt><dd>{trackingValue(user.registration_browser)}</dd></div>
                                  <div><dt className="text-gray-500">Device</dt><dd>{trackingValue(user.registration_device)}</dd></div>
                                  <div><dt className="text-gray-500">Operating System</dt><dd>{trackingValue(user.registration_operating_system)}</dd></div>
                                </dl>
                              </div>

                              <div className="bg-white rounded-lg border border-gray-200 p-4">
                                <h3 className="font-semibold text-gray-900 mb-3">Login & Activity Tracking</h3>
                                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div><dt className="text-gray-500">Last Login</dt><dd>{formatDateTime(user.last_login_at)}</dd></div>
                                  <div><dt className="text-gray-500">Last Seen</dt><dd>{formatDateTime(user.last_seen_at)}</dd></div>
                                  <div><dt className="text-gray-500">Login IP Address</dt><dd>{trackingValue(user.last_login_ip_address)}</dd></div>
                                  <div><dt className="text-gray-500">Login Location</dt><dd>{trackingValue(user.last_login_ip_location)}</dd></div>
                                  <div><dt className="text-gray-500">Login Browser</dt><dd>{trackingValue(user.last_login_browser)}</dd></div>
                                  <div><dt className="text-gray-500">Login Device</dt><dd>{trackingValue(user.last_login_device)}</dd></div>
                                  <div><dt className="text-gray-500">Login OS</dt><dd>{trackingValue(user.last_login_operating_system)}</dd></div>
                                  <div><dt className="text-gray-500">Photo Type</dt><dd>{user.captureType === 'selfie' ? 'Selfie' : user.captureType === 'id' ? 'ID Document' : '—'}</dd></div>
                                </dl>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
          <div className="text-xs text-gray-500 mt-1 text-center">
            View approved users in Discourse
          </div>
        </div>
      )}
    </AdminLayout>
  );
}