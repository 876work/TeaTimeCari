import { useState } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { CheckCircle2, Mail, Send, XCircle } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { getFunctionErrorMessage } from "@/lib/functionError";
import {
  AdminAlert,
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminPageHeader,
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export function AdminInvites({ activePage, onNavigate }: AdminInvitesProps) {
  const supabase = useSupabaseClient();

  const [emailsInput, setEmailsInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<InviteResult[] | null>(null);

  const parsedEmails = parseEmails(emailsInput);
  const invalidEmails = parsedEmails.filter((email) => !EMAIL_REGEX.test(email));

  const handleSend = async () => {
    setError(null);
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
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className="space-y-6">
        <AdminPageHeader
          title="Invites"
          description="Invite new members by email. Each recipient gets a link to create their Tea Time Cari account."
        />

        {error && <AdminAlert variant="error">{error}</AdminAlert>}

        <AdminCard
          title="Send invites"
          description="Separate multiple email addresses with a comma."
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
      </div>
    </AdminLayout>
  );
}
