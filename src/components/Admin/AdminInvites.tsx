import { useEffect, useState } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import {
  Ban,
  CheckCircle2,
  Download,
  KeyRound,
  Mail,
  Plus,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { getFunctionErrorMessage } from "@/lib/functionError";
import { downloadCsv, csvTimestamp } from "@/lib/adminCsv";
import {
  AdminAlert,
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminEmptyState,
  AdminInput,
  AdminMetricCard,
  AdminPageHeader,
  AdminSkeleton,
} from "./ui";

interface AdminInvitesProps {
  activePage?: string;
  onNavigate?: (page: string) => void;
}

interface InviteResult {
  email: string;
  success: boolean;
  error?: string;
}

interface EmailInvite {
  id: string;
  email: string;
  status: "sent" | "failed" | "accepted" | "revoked";
  sent_count: number;
  last_sent_at: string | null;
  last_error: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
  invited_by_email: string | null;
  created_at: string;
}

interface InviteCode {
  id: string;
  code: string;
  usage_limit: number;
  usage_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inviteStatusBadge: Record<EmailInvite["status"], "success" | "warning" | "danger" | "muted"> = {
  accepted: "success",
  sent: "warning",
  failed: "danger",
  revoked: "muted",
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function parseEmails(raw: string): string[] {
  const seen = new Set<string>();
  const emails: string[] = [];

  for (const part of raw.split(/[,\n]/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    emails.push(trimmed);
  }

  return emails;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminInvites({ activePage, onNavigate }: AdminInvitesProps) {
  const supabase = useSupabaseClient();

  const [emailsInput, setEmailsInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [results, setResults] = useState<InviteResult[] | null>(null);

  const [invites, setInvites] = useState<EmailInvite[]>([]);
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);

  const [showCodeForm, setShowCodeForm] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newCodeLimit, setNewCodeLimit] = useState(10);
  const [newCodeDays, setNewCodeDays] = useState(30);

  const parsedEmails = parseEmails(emailsInput);
  const invalidEmails = parsedEmails.filter((email) => !EMAIL_REGEX.test(email));

  const invokeInvites = async (payload: Record<string, unknown>) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) throw new Error("You must be logged in as an admin.");

    const { data, error: fnError } = await supabase.functions.invoke("admin-invites", {
      body: payload,
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (fnError) throw new Error(await getFunctionErrorMessage(fnError));
    if (!data?.ok) throw new Error(data?.error || "Invite request failed.");

    return data;
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);

    try {
      const data = await invokeInvites({ action: "list" });
      setInvites(data.invites ?? []);
      setCodes(data.codes ?? []);
      setTableMissing(Boolean(data.tableMissing));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = async () => {
    setError(null);
    setNotice(null);
    setResults(null);

    if (parsedEmails.length === 0) {
      setError("Enter at least one email address.");
      return;
    }

    if (invalidEmails.length > 0) {
      setError(`These emails don't look valid: ${invalidEmails.join(", ")}`);
      return;
    }

    setSending(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("You must be logged in as an admin.");
      }

      const { data, error: fnError } = await supabase.functions.invoke(
        "send-invite-email",
        {
          body: { emails: parsedEmails },
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      if (fnError) {
        throw new Error(await getFunctionErrorMessage(fnError));
      }

      if (!data?.results) {
        throw new Error(data?.error || "Unable to send invites.");
      }

      setResults(data.results);
      if (data.success) {
        setEmailsInput("");
      }

      await fetchHistory();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const handleResend = async (invite: EmailInvite) => {
    setProcessingId(invite.id);
    setError(null);
    setNotice(null);

    try {
      const data = await invokeInvites({ action: "resend", invite_id: invite.id });
      setInvites(data.invites ?? []);
      setNotice(`Invite resent to ${invite.email}.`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setProcessingId(null);
    }
  };

  const handleRevoke = async (invite: EmailInvite) => {
    if (!confirm(`Revoke the invite for ${invite.email}? They can no longer be resent this invite.`)) return;

    setProcessingId(invite.id);
    setError(null);
    setNotice(null);

    try {
      const data = await invokeInvites({ action: "revoke", invite_id: invite.id });
      setInvites(data.invites ?? []);
      setNotice(`Invite for ${invite.email} revoked.`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleCode = async (code: InviteCode) => {
    setProcessingId(code.id);
    setError(null);

    try {
      const data = await invokeInvites({ action: "toggle-code", code_id: code.id });
      setCodes(data.codes ?? []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setProcessingId(null);
    }
  };

  const handleCreateCode = async () => {
    setProcessingId("new-code");
    setError(null);
    setNotice(null);

    try {
      const data = await invokeInvites({
        action: "create-code",
        code: newCode,
        usage_limit: newCodeLimit,
        expires_in_days: newCodeDays,
      });
      setCodes(data.codes ?? []);
      setNotice(`Invite code ${newCode.toUpperCase()} created.`);
      setNewCode("");
      setShowCodeForm(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setProcessingId(null);
    }
  };

  const exportCsv = () => {
    downloadCsv(`teatimecari-invites-${csvTimestamp()}`, invites, [
      { header: "Email", value: (row) => row.email },
      { header: "Status", value: (row) => row.status },
      { header: "Times sent", value: (row) => row.sent_count },
      { header: "First invited", value: (row) => row.created_at },
      { header: "Last sent", value: (row) => row.last_sent_at },
      { header: "Accepted", value: (row) => row.accepted_at },
      { header: "Revoked", value: (row) => row.revoked_at },
      { header: "Invited by", value: (row) => row.invited_by_email },
      { header: "Last error", value: (row) => row.last_error },
    ]);
  };

  const stats = {
    total: invites.length,
    accepted: invites.filter((invite) => invite.status === "accepted").length,
    outstanding: invites.filter((invite) => invite.status === "sent").length,
    failed: invites.filter((invite) => invite.status === "failed").length,
  };
  const conversion = stats.total > 0 ? Math.round((stats.accepted / stats.total) * 100) : 0;

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className="space-y-6">
        <AdminPageHeader
          title="Invites"
          description="Invite new members by email, track who accepted, and manage signup invite codes."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <AdminButton type="button" variant="glass" onClick={exportCsv} disabled={invites.length === 0}>
                <Download className="h-4 w-4" />
                Export CSV
              </AdminButton>
              <AdminButton type="button" variant="glass" onClick={fetchHistory} disabled={historyLoading}>
                <RefreshCw className={`h-4 w-4 ${historyLoading ? "animate-spin" : ""}`} />
                Refresh
              </AdminButton>
            </div>
          }
        />

        {error && <AdminAlert variant="error">{error}</AdminAlert>}
        {notice && <AdminAlert variant="success">{notice}</AdminAlert>}

        {tableMissing && (
          <AdminAlert variant="warning">
            <p className="font-semibold">Invite history unavailable</p>
            <p className="mt-1">The email_invites table is missing. Run the pending database migrations — new invites will still send.</p>
          </AdminAlert>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminMetricCard title="Invites sent" value={stats.total} description="Unique email addresses invited" icon={<Mail className="h-5 w-5" />} accent="brand" loading={historyLoading} />
          <AdminMetricCard title="Accepted" value={stats.accepted} description={`${conversion}% conversion`} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" loading={historyLoading} />
          <AdminMetricCard title="Outstanding" value={stats.outstanding} description="Sent but not yet registered" icon={<Send className="h-5 w-5" />} accent="info" loading={historyLoading} />
          <AdminMetricCard title="Failed" value={stats.failed} description="Delivery problems to review" icon={<XCircle className="h-5 w-5" />} accent={stats.failed > 0 ? "danger" : "muted"} loading={historyLoading} />
        </div>

        <AdminCard
          title="Send invites"
          description="Separate multiple email addresses with a comma. Each recipient gets a Resend email with a link to create their account."
        >
          <div className="space-y-4">
            <textarea
              value={emailsInput}
              onChange={(event) => setEmailsInput(event.target.value)}
              placeholder="jane@example.com, john@example.com"
              rows={4}
              disabled={sending}
              className="w-full rounded-admin-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none transition-all duration-150 hover:border-white/30 focus:border-white/50 focus:ring-4 focus:ring-white/15 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/30"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-white/60">
                {parsedEmails.length > 0
                  ? `${parsedEmails.length} email${parsedEmails.length === 1 ? "" : "s"} ready to invite`
                  : "No emails entered yet"}
              </p>

              <AdminButton
                type="button"
                variant="primary"
                onClick={handleSend}
                loading={sending}
                disabled={sending || parsedEmails.length === 0}
              >
                <Send className="h-4 w-4" />
                Send invite{parsedEmails.length === 1 ? "" : "s"}
              </AdminButton>
            </div>
          </div>
        </AdminCard>

        {results && (
          <AdminCard
            title="Results"
            description="Delivery status for the most recent invite batch."
          >
            <ul className="space-y-2">
              {results.map((result) => (
                <li
                  key={result.email}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-3"
                >
                  <span className="flex min-w-0 items-center gap-2 text-sm text-white">
                    <Mail className="h-4 w-4 flex-shrink-0 text-white/50" />
                    <span className="truncate">{result.email}</span>
                  </span>

                  {result.success ? (
                    <AdminBadge variant="success">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Sent
                    </AdminBadge>
                  ) : (
                    <AdminBadge variant="danger" className="max-w-[60%]">
                      <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate" title={result.error}>
                        {result.error || "Failed"}
                      </span>
                    </AdminBadge>
                  )}
                </li>
              ))}
            </ul>
          </AdminCard>
        )}

        <AdminCard
          className="p-0"
          title="Invite history"
          description="Every email invite with its lifecycle status. Accepted is detected automatically when the address registers."
        >
          {historyLoading ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2].map((item) => (
                <AdminSkeleton key={item} className="h-12 w-full" />
              ))}
            </div>
          ) : invites.length === 0 ? (
            <AdminEmptyState
              icon={<Mail className="h-8 w-8" />}
              title="No invites tracked yet"
              message="Invites sent from this page will appear here with delivery and acceptance status."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-white/15 bg-white/10">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/50">Email</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/50">Status</th>
                    <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/50 md:table-cell">Sent</th>
                    <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/50 lg:table-cell">Last activity</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-white/50">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {invites.map((invite) => (
                    <tr key={invite.id} className="transition-colors hover:bg-white/5">
                      <td className="px-5 py-3">
                        <p className="truncate text-sm font-semibold text-white">{invite.email}</p>
                        {invite.invited_by_email && (
                          <p className="text-xs text-white/40">Invited by {invite.invited_by_email}</p>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <AdminBadge variant={inviteStatusBadge[invite.status]}>
                          {invite.status.charAt(0).toUpperCase() + invite.status.slice(1)}
                        </AdminBadge>
                        {invite.status === "failed" && invite.last_error && (
                          <p className="mt-1 max-w-[220px] truncate text-xs text-rose-300" title={invite.last_error}>
                            {invite.last_error}
                          </p>
                        )}
                      </td>
                      <td className="hidden px-5 py-3 text-xs text-white/70 md:table-cell">
                        {invite.sent_count}× · last {formatDateTime(invite.last_sent_at)}
                      </td>
                      <td className="hidden px-5 py-3 text-xs text-white/70 lg:table-cell">
                        {invite.status === "accepted"
                          ? `Accepted ${formatDateTime(invite.accepted_at)}`
                          : invite.status === "revoked"
                            ? `Revoked ${formatDateTime(invite.revoked_at)}`
                            : `Invited ${formatDateTime(invite.created_at)}`}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {(invite.status === "sent" || invite.status === "failed") && (
                            <>
                              <AdminButton
                                size="sm"
                                variant="secondary"
                                onClick={() => handleResend(invite)}
                                loading={processingId === invite.id}
                              >
                                Resend
                              </AdminButton>
                              <AdminButton
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRevoke(invite)}
                                disabled={processingId === invite.id}
                              >
                                <Ban className="h-4 w-4" />
                                Revoke
                              </AdminButton>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminCard>

        <AdminCard
          className="p-0"
          title="Invite codes"
          description="Signup codes used during registration, with usage tracking."
          actions={
            <AdminButton size="sm" variant="secondary" onClick={() => setShowCodeForm((open) => !open)}>
              <Plus className="h-4 w-4" />
              New code
            </AdminButton>
          }
        >
          {showCodeForm && (
            <div className="border-b border-white/15 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex-1 text-xs font-semibold uppercase tracking-wide text-white/60">
                  Code
                  <AdminInput
                    value={newCode}
                    onChange={(event) => setNewCode(event.target.value.toUpperCase())}
                    placeholder="SUMMER2026"
                    className="mt-2"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-white/60 sm:w-32">
                  Usage limit
                  <AdminInput
                    type="number"
                    min={1}
                    value={newCodeLimit}
                    onChange={(event) => setNewCodeLimit(parseInt(event.target.value) || 1)}
                    className="mt-2"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-white/60 sm:w-32">
                  Expires (days)
                  <AdminInput
                    type="number"
                    min={1}
                    value={newCodeDays}
                    onChange={(event) => setNewCodeDays(parseInt(event.target.value) || 1)}
                    className="mt-2"
                  />
                </label>
                <AdminButton
                  type="button"
                  variant="primary"
                  onClick={handleCreateCode}
                  loading={processingId === "new-code"}
                  disabled={newCode.trim().length < 4 || processingId === "new-code"}
                >
                  Create code
                </AdminButton>
              </div>
            </div>
          )}

          {historyLoading ? (
            <div className="space-y-3 p-5">
              {[0, 1].map((item) => (
                <AdminSkeleton key={item} className="h-12 w-full" />
              ))}
            </div>
          ) : codes.length === 0 ? (
            <AdminEmptyState
              icon={<KeyRound className="h-8 w-8" />}
              title="No invite codes found"
              message="Create a code to allow controlled self-serve signups."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-white/15 bg-white/10">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/50">Code</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/50">Usage</th>
                    <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/50 md:table-cell">Expires</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/50">Status</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-white/50">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {codes.map((code) => {
                    const expired = code.expires_at ? new Date(code.expires_at).getTime() < Date.now() : false;
                    const exhausted = code.usage_count >= code.usage_limit;

                    return (
                      <tr key={code.id} className="transition-colors hover:bg-white/5">
                        <td className="px-5 py-3 font-mono text-sm font-semibold text-white">{code.code}</td>
                        <td className="px-5 py-3 text-sm text-white/80">
                          {code.usage_count} / {code.usage_limit}
                        </td>
                        <td className="hidden px-5 py-3 text-xs text-white/70 md:table-cell">{formatDateTime(code.expires_at)}</td>
                        <td className="px-5 py-3">
                          <AdminBadge variant={!code.is_active ? "muted" : expired ? "danger" : exhausted ? "warning" : "success"}>
                            {!code.is_active ? "Disabled" : expired ? "Expired" : exhausted ? "Exhausted" : "Active"}
                          </AdminBadge>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <AdminButton
                            size="sm"
                            variant="secondary"
                            onClick={() => handleToggleCode(code)}
                            loading={processingId === code.id}
                          >
                            {code.is_active ? "Disable" : "Enable"}
                          </AdminButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </AdminCard>
      </div>
    </AdminLayout>
  );
}
