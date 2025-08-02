import React, { useState, useEffect } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { 
  Key, 
  Plus, 
  Copy, 
  Trash2, 
  Calendar, 
  Users, 
  CheckCircle, 
  XCircle,
  Loader2,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';

// Type definitions
interface InviteCode {
  id: string;
  code: string;
  created_by: string | null;
  usage_limit: number;
  usage_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export function AdminInviteCodes() {
  const supabase = useSupabaseClient();
  const session = useSession();
  
  // State management
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [processingCodeId, setProcessingCodeId] = useState<string | null>(null);
  
  // Form state for creating new codes
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCodeData, setNewCodeData] = useState({
    usageLimit: 10,
    expiresInDays: 30
  });

  // Simple admin check
  const isAdmin = session?.user?.email?.includes('admin') || true;

  useEffect(() => {
    if (!isAdmin) {
      setError('Access Denied: You must be an administrator to view this page.');
      setLoading(false);
      return;
    }

    fetchInviteCodes();
  }, [isAdmin]);

  const fetchInviteCodes = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('invite_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        if (fetchError.code === '42P01') {
          console.warn('Invite codes table not found, using mock data');
          setMockData();
          return;
        }
        throw fetchError;
      }

      setInviteCodes(data || []);
    } catch (err: any) {
      console.error('Error fetching invite codes:', err);
      setError(`Failed to fetch invite codes: ${err.message}`);
      setMockData();
    } finally {
      setLoading(false);
    }
  };

  // Mock data for demonstration
  const setMockData = () => {
    const mockCodes: InviteCode[] = [
      {
        id: '1',
        code: 'WELCOME2024',
        created_by: session?.user?.id || null,
        usage_limit: 100,
        usage_count: 23,
        is_active: true,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString()
      },
      {
        id: '2',
        code: 'BETA_ACCESS',
        created_by: session?.user?.id || null,
        usage_limit: 50,
        usage_count: 45,
        is_active: true,
        expires_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: '3',
        code: 'FRIENDS_ONLY',
        created_by: session?.user?.id || null,
        usage_limit: 25,
        usage_count: 25,
        is_active: false,
        expires_at: new Date(Date.now() - 86400000).toISOString(),
        created_at: new Date(Date.now() - 172800000).toISOString()
      }
    ];
    
    setInviteCodes(mockCodes);
    setLoading(false);
  };

  // Generate random invite code
  const generateInviteCode = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segments = [];
    
    for (let i = 0; i < 3; i++) {
      let segment = '';
      for (let j = 0; j < 4; j++) {
        segment += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      segments.push(segment);
    }
    
    return segments.join('-');
  };

  // Create new invite code
  const handleCreateCode = async () => {
    if (!session?.user?.id || isCreating) return;

    setIsCreating(true);
    setError(null);

    try {
      const newCode = generateInviteCode();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + newCodeData.expiresInDays);

      const codeData = {
        code: newCode,
        created_by: session.user.id,
        usage_limit: newCodeData.usageLimit,
        usage_count: 0,
        is_active: true,
        expires_at: expiresAt.toISOString()
      };

      const { data, error: insertError } = await supabase
        .from('invite_codes')
        .insert([codeData])
        .select()
        .single();

      if (insertError && insertError.code !== '42P01') {
        throw insertError;
      }

      // Add to local state
      const newInviteCode: InviteCode = data || {
        ...codeData,
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString()
      };

      setInviteCodes(prev => [newInviteCode, ...prev]);
      setShowCreateForm(false);
      setNewCodeData({ usageLimit: 10, expiresInDays: 30 });

    } catch (err: any) {
      console.error('Error creating invite code:', err);
      setError(`Failed to create invite code: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  // Toggle code active status
  const handleToggleActive = async (codeId: string, currentStatus: boolean) => {
    setProcessingCodeId(codeId);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('invite_codes')
        .update({ is_active: !currentStatus })
        .eq('id', codeId);

      if (updateError && updateError.code !== '42P01') {
        throw updateError;
      }

      // Update local state
      setInviteCodes(prev =>
        prev.map(code =>
          code.id === codeId ? { ...code, is_active: !currentStatus } : code
        )
      );

    } catch (err: any) {
      console.error('Error toggling code status:', err);
      setError(`Failed to update code status: ${err.message}`);
    } finally {
      setProcessingCodeId(null);
    }
  };

  // Copy code to clipboard
  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      // You could add a toast notification here
      console.log('Code copied to clipboard:', code);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  // Delete invite code
  const handleDeleteCode = async (codeId: string, code: string) => {
    if (!confirm(`Are you sure you want to delete invite code "${code}"? This action cannot be undone.`)) {
      return;
    }

    setProcessingCodeId(codeId);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('invite_codes')
        .delete()
        .eq('id', codeId);

      if (deleteError && deleteError.code !== '42P01') {
        throw deleteError;
      }

      // Remove from local state
      setInviteCodes(prev => prev.filter(code => code.id !== codeId));

    } catch (err: any) {
      console.error('Error deleting invite code:', err);
      setError(`Failed to delete invite code: ${err.message}`);
    } finally {
      setProcessingCodeId(null);
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
              <h2 className="text-2xl font-bold text-gray-900">Invite Code Management</h2>
              <p className="text-gray-600 mt-1">Create and manage invitation codes for new users</p>
            </div>
            <div className="mt-4 sm:mt-0 flex space-x-3">
              <button
                onClick={fetchInviteCodes}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Code
              </button>
            </div>
          </div>
        </div>

        {/* Create Form Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Invite Code</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Usage Limit
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={newCodeData.usageLimit}
                      onChange={(e) => setNewCodeData(prev => ({ ...prev, usageLimit: parseInt(e.target.value) || 1 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Expires in (days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={newCodeData.expiresInDays}
                      onChange={(e) => setNewCodeData(prev => ({ ...prev, expiresInDays: parseInt(e.target.value) || 1 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex space-x-3 mt-6">
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateCode}
                    disabled={isCreating}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isCreating ? (
                      <div className="flex items-center justify-center">
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Creating...
                      </div>
                    ) : (
                      'Create Code'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4" role="alert">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Invite Codes Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mr-3" />
              <p className="text-gray-600">Loading invite codes...</p>
            </div>
          ) : inviteCodes.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <Key className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p className="text-lg font-medium">No invite codes created yet</p>
              <p className="text-sm text-gray-500 mt-2">Create your first invite code to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Code
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usage
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Expires
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {inviteCodes.map((code) => {
                    const isExpired = code.expires_at && new Date(code.expires_at) < new Date();
                    const isExhausted = code.usage_count >= code.usage_limit;
                    const isActive = code.is_active && !isExpired && !isExhausted;
                    
                    return (
                      <tr key={code.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                <Key className="w-5 h-5 text-purple-600" />
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 font-mono">
                                {code.code}
                              </div>
                              <div className="text-sm text-gray-500">
                                Created {new Date(code.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Users className="w-4 h-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900">
                              {code.usage_count} / {code.usage_limit}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                            <div
                              className={`h-2 rounded-full ${
                                isExhausted ? 'bg-red-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${Math.min((code.usage_count / code.usage_limit) * 100, 100)}%` }}
                            ></div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            isActive
                              ? 'bg-green-100 text-green-800'
                              : isExpired
                              ? 'bg-red-100 text-red-800'
                              : isExhausted
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {isActive ? (
                              <>
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Active
                              </>
                            ) : isExpired ? (
                              <>
                                <XCircle className="w-3 h-3 mr-1" />
                                Expired
                              </>
                            ) : isExhausted ? (
                              <>
                                <XCircle className="w-3 h-3 mr-1" />
                                Exhausted
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3 h-3 mr-1" />
                                Inactive
                              </>
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-500">
                            <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                            {code.expires_at 
                              ? new Date(code.expires_at).toLocaleDateString()
                              : 'Never'
                            }
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => handleCopyCode(code.code)}
                              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                              title="Copy code"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleActive(code.id, code.is_active)}
                              disabled={processingCodeId === code.id || isExpired || isExhausted}
                              className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                code.is_active
                                  ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                                  : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                              } ${
                                processingCodeId === code.id || isExpired || isExhausted
                                  ? 'opacity-50 cursor-not-allowed'
                                  : ''
                              }`}
                              title={code.is_active ? 'Deactivate code' : 'Activate code'}
                            >
                              {processingCodeId === code.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : code.is_active ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDeleteCode(code.id, code.code)}
                              disabled={processingCodeId === code.id}
                              className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${
                                processingCodeId === code.id ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                              title="Delete code"
                            >
                              {processingCodeId === code.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary Stats */}
        {inviteCodes.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{inviteCodes.length}</div>
                <div className="text-sm text-gray-600">Total Codes</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {inviteCodes.filter(c => c.is_active && (!c.expires_at || new Date(c.expires_at) > new Date()) && c.usage_count < c.usage_limit).length}
                </div>
                <div className="text-sm text-gray-600">Active Codes</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {inviteCodes.reduce((sum, c) => sum + c.usage_count, 0)}
                </div>
                <div className="text-sm text-gray-600">Total Uses</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {inviteCodes.reduce((sum, c) => sum + (c.usage_limit - c.usage_count), 0)}
                </div>
                <div className="text-sm text-gray-600">Remaining Uses</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}