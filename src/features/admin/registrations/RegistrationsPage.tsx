// src/features/admin/registrations/RegistrationsPage.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { approveRegistration } from './api/approveRegistration';

type Row = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  gender?: 'Male' | 'Female' | null;
  created_at?: string | null;
  status: 'pending' | 'approved' | 'rejected';
};

export default function RegistrationsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const { data, error } = await supabase
      .from('registrations')
      .select('id,firstName,lastName,email,gender,created_at,status')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) setErr(error.message);
    else setRows(data ?? []);
  }

  useEffect(() => { load(); }, []);

  const getDisplayName = (row: Row) => {
    const full = [row.firstName?.trim(), row.lastName?.trim()]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (full) return full;
    if (row.email) return row.email;
    return 'user';
  };

  const getFirstName = (row: Row) => {
    const full = [row.firstName?.trim(), row.lastName?.trim()]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (full) {
      const parts = full.split(' ').filter(Boolean); // always a string here
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

      // find the row so we can show a safe success message
      const row = rows.find(r => r.id === id);

      await approveRegistration(id);
      await load();

      // show a safe confirmation (no unsafe .split calls)
      const name = row ? getFirstName(row) : 'user';
      alert(`Approved ${name}`);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to approve');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-4">
      <h1>Pending Registrations</h1>
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
