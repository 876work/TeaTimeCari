import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { approveRegistration } from './api/approveRegistration';

type Row = {
  id: string;
  firstName: string;
  lastName: string;
  lastName: string;
  email: string;
  gender: 'Male' | 'Female';
  created_at: string;
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

  async function handleApprove(id: string) {
    try {
      setBusyId(id);
      setErr(null);
      await approveRegistration(id);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to approve');
    } finally {
      setBusyId(null);
    }
  }

  const getFullName = (row: Row) => `${row.firstName} ${row.lastName}`.trim();

  const getFullName = (row: Row) => `${row.firstName} ${row.lastName}`.trim();

  return (
    <div className="p-4">
      <h1>Pending Registrations</h1>
      {err && <div style={{color:'red'}}>{err}</div>}
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Gender</th><th>Submitted</th><th /></tr></thead>
        <tbody>
        {rows.map(r => (
          <tr key={r.id}>
            <td>{getFullName(r)}</td>
            <td>{r.email}</td>
            <td>{r.gender}</td>
            <td>{new Date(r.created_at).toLocaleString()}</td>
            <td>
              <button disabled={busyId===r.id} onClick={() => handleApprove(r.id)}>
                {busyId===r.id ? 'Approving…' : 'Approve'}
              </button>
            </td>
          </tr>
        ))}
        </tbody>
      </table>
    </div>
  );
}