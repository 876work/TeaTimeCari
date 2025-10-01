// src/features/admin/registrations/RegistrationsPage.tsx
import { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { approveRegistration } from './api/approveRegistration';

type Row = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;   // <-- add this
  email?: string | null;
  gender?: 'Male' | 'Female' | null;
  created_at?: string | null;
  status: 'pending' | 'approved' | 'rejected';
};

export default function RegistrationsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function load() {
    const { data, error } = await supabase
      .from('registrations')
      .select('id,firstName,lastName,email,gender,created_at,status')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      setErr(error.message);
    } else {
      const mapped: Row[] = (data ?? []).map((r: any) => {
        const full = [r.firstName?.trim(), r.lastName?.trim()]
          .filter(Boolean)
          .join(' ')
          .trim();
        return { ...r, fullName: full || null }; // ensure fullName is always present (string or null)
      });
      setRows(mapped);
    }
  }

  useEffect(() => { load(); }, []);

  const getDisplayName = (row: Row) =>
    (row.fullName && row.fullName.trim()) ||
    [row.firstName, row.lastName].filter(Boolean).join(' ').trim() ||
    row.email ||
    'user';

  const getFirstName = (row: Row) => {
    const full = (row.fullName && row.fullName.trim())
      || [row.firstName, row.lastName].filter(Boolean).join(' ').trim()
      || '';
    if (full) {
      const parts = full.split(' ').filter(Boolean);
      return parts[0] || 'user';
    }
    if (row.email) {
      const at = row.email.indexOf('@');
      return at > 0 ? row.email.slice(0, at) : row.email;
    }
    return 'user';
  };

  async function handleApprove(id: string) {
    try {
      setBusyId(id);
      setErr(null);
      setSuccessMessage(null);
      setErrorMessage(null);

      const row = rows.find(r => r.id === id);

      await approveRegistration(id);
      await load();

      const userName = row ? getFirstName(row) : 'user';
      setSuccessMessage(`✅ ${userName} has been approved successfully and will receive an email with verification instructions.`);
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (e: any) {
      const userName = rows.find(r => r.id === id) ? getFirstName(rows.find(r => r.id === id)!) : 'user';
      setErrorMessage(`Failed to approve ${userName}: ${e?.message ?? 'Unknown error'}`);
      
      // Clear error message after 8 seconds
      setTimeout(() => {
        setErrorMessage(null);
      }, 8000);
    } finally {
      setBusyId(null);
    }
  }

  const clearSuccessMessage = () => {
    setSuccessMessage(null);
  };

  const clearErrorMessage = () => {
    setErrorMessage(null);
  };

  return (
    <div className="p-4">
      <h1>Pending Registrations</h1>
      
      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between" role="alert">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
            <span className="text-green-700 text-sm font-medium">{successMessage}</span>
          </div>
          <button
            onClick={clearSuccessMessage}
            className="text-green-500 hover:text-green-700 transition-colors"
            aria-label="Close success message"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {/* Error Message */}
      {errorMessage && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between" role="alert">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-red-700 text-sm font-medium">{errorMessage}</span>
          </div>
          <button
            onClick={clearErrorMessage}
            className="text-red-500 hover:text-red-700 transition-colors"
            aria-label="Close error message"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {err && <div style={{ color: 'red' }}>{err}</div>}
      <table>
        <thead>
          <tr>
            <th>Name</th><th>Email</th><th>Gender</th><th>Submitted</th><th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{getDisplayName(r)}</td>
              <td>{r.email ?? ''}</td>
              <td>{r.gender ?? ''}</td>
              <td>{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</td>
              <td>
                <button disabled={busyId === r.id} onClick={() => handleApprove(r.id)}>
                  {busyId === r.id ? 'Approving…' : 'Approve'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}