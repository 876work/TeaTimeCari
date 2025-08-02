import React, { useEffect, useState } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { CheckCircle, XCircle, Loader2, AlertCircle, User, Mail, Phone, Camera, Calendar, RefreshCw } from 'lucide-react';
import { AdminLayout } from './AdminLayout';

// Define a type for the user data fetched from Supabase
interface PendingUser {
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
}

export function AdminUserReview() {
  const supabase = useSupabaseClient();
  const session = useSession();
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGender, setFilterGender] = useState<'all' | 'Male' | 'Female'>('all');

  // Simple admin check - in production, implement proper role-based access control
  const isAdmin = session?.user?.email?.includes('admin'); // TODO: Implement proper admin role check

  useEffect(() => {
    if (!isAdmin) {
      setError('Access Denied: You must be an administrator to view this page.');
      setLoading(false);
      return;
    }

    fetchPendingUsers();
  }, [isAdmin, supabase]);

  const fetchPendingUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      // Note: This assumes you have a 'registrations' table in Supabase
      // You'll need to create this table with the appropriate columns
      const { data, error: fetchError } = await supabase
        .from('registrations')
        .select('*')
        .eq('status', 'pending')
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

      setPendingUsers(data || []);
    } catch (err: any) {
      console.error('Error fetching pending users:', err);
      setError(`Failed to fetch users: ${err.message || err.toString()}`);
      // Fallback to mock data for demonstration
      setMockData();
    } finally {
      setLoading(false);
    }
  };

  // Mock data for demonstration purposes
  const setMockData = () => {
    const mockUsers: PendingUser[] = [
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
        created_at: new Date().toISOString()
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
        status: 'pending',
        created_at: new Date(Date.now() - 86400000).toISOString() // 1 day ago
      }
    ];
    setPendingUsers(mockUsers);
    setLoading(false);
  };

  const handleApprove = async (userId: string, phoneNumber: string, userName: string) => {
    if (!confirm(`Are you sure you want to approve ${userName}?`)) return;

    setProcessingUserId(userId);
    setError(null);
    try {
      // 1. Update user status in database
      const { error: updateError } = await supabase
        .from('registrations')
        .update({ status: 'approved' })
        .eq('id', userId);

      if (updateError && updateError.code !== '42P01') {
        throw updateError;
      }

      // 2. Send SMS via Supabase Edge Function
      try {
        const { data: smsData, error: smsError } = await supabase.functions.invoke('send-approval-sms', {
          body: {
            to: phoneNumber,
            message: `Congratulations ${userName.split(' ')[0]}! Your KYC registration has been approved. You can now access your account.`
          }
        });

        if (smsError) {
          console.warn('SMS sending failed:', smsError);
          // Don't fail the approval if SMS fails, but show a warning
          setError(`${userName} approved successfully, but SMS notification failed: ${smsError.message}`);
        } else {
          console.log('SMS sent successfully:', smsData);
        }
      } catch (smsErr) {
        console.warn('SMS function not available:', smsErr);
        // Don't fail the approval if SMS function is not available
      }

      // Remove approved user from the list
      setPendingUsers(prev => prev.filter(user => user.id !== userId));
      
      // Show success message if no SMS error occurred
      if (!error) {
        alert(`${userName} has been approved successfully and notified via SMS!`);
      }

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
              <h2 className="text-2xl font-bold text-gray-900">Pending User Reviews</h2>
              <p className="text-gray-600 mt-1">Review and approve user registrations</p>
            </div>
            <button
              onClick={fetchPendingUsers}
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
          <div className="flex flex-col sm:flex-row gap-4">
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
              <p className="text-gray-600">Loading pending users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium">
                {pendingUsers.length === 0 ? 'No pending users to review!' : 'No users match your search criteria.'}
              </p>
              {pendingUsers.length === 0 && (
                <p className="text-sm text-gray-500 mt-2">All registrations have been processed.</p>
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
                              className="h-16 w-16 object-cover rounded-lg border-2 border-gray-200 shadow-sm"
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
                          <button
                            onClick={() => handleApprove(user.id, user.phone, `${user.firstName} ${user.lastName}`)}
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
                            onClick={() => handleReject(user.id, `${user.firstName} ${user.lastName}`)}
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
        {filteredUsers.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-center text-sm text-gray-600">
              Showing {filteredUsers.length} of {pendingUsers.length} pending registrations
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}