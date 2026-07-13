import React, { useState } from "react";
import * as Sentry from "@sentry/react";
import { useSession } from "@supabase/auth-helpers-react";
import { supabase } from '@/lib/supabaseClient';

export default function FunctionPing() {
  const session = useSession();
  const [approvalResp, setApprovalResp] = useState<unknown>(null);
  const [rejectionResp, setRejectionResp] = useState<unknown>(null);
  const [errA, setErrA] = useState<unknown>(null);
  const [errR, setErrR] = useState<unknown>(null);
  const [backfillResp, setBackfillResp] = useState<unknown>(null);
  const [errB, setErrB] = useState<unknown>(null);
  const [backfillRunning, setBackfillRunning] = useState(false);

  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const computedFnUrl = url ? `${url}/functions/v1` : "(missing URL)";

  const headers = {
    Authorization: `Bearer ${anon}`,
    apikey: anon,
    "Content-Type": "application/json",
  };

  const hitApproval = async () => {
    setErrA(null); setApprovalResp(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-approval-email", {
        body: { email: "you@example.com", firstName: "Ping" },
        headers,
      });
      if (error) setErrA(error);
      setApprovalResp({ data, error });
    } catch (e: unknown) {
      setErrA({ message: e instanceof Error ? e.message : String(e) });
    }
  };

  const hitRejection = async () => {
    setErrR(null); setRejectionResp(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-rejection-email", {
        body: { email: "you@example.com", firstName: "Ping", reason: "Diagnostic" },
        headers,
      });
      if (error) setErrR(error);
      setRejectionResp({ data, error });
    } catch (e: unknown) {
      setErrR({ message: e instanceof Error ? e.message : String(e) });
    }
  };

  async function rawFetchApproval() {
    try {
      const resp = await fetch(`${url.replace(/\/+$/, '')}/functions/v1/send-approval-email`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${anon}`,
          apikey: anon,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'you@example.com', firstName: 'Ping' }),
      });
      const text = await resp.text();
      return { status: resp.status, ok: resp.ok, headers: Object.fromEntries(resp.headers.entries()), body: text };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }

  const runLocationBackfill = async () => {
    setErrB(null);
    setBackfillResp(null);

    if (!session?.access_token) {
      setErrB({ message: "You must be logged in as an admin to run this." });
      return;
    }

    setBackfillRunning(true);

    try {
      const { data, error } = await supabase.functions.invoke("backfill-location-tracking", {
        body: { limit: 25 },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) setErrB(error);
      setBackfillResp({ data, error });
    } catch (e: unknown) {
      setErrB({ message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBackfillRunning(false);
    }
  };

  async function rawFetchRejection() {
    try {
      const resp = await fetch(`${url.replace(/\/+$/, '')}/functions/v1/send-rejection-email`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${anon}`,
          apikey: anon,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'you@example.com', firstName: 'Ping', reason: 'Diagnostic' }),
      });
      const text = await resp.text();
      return { status: resp.status, ok: resp.ok, headers: Object.fromEntries(resp.headers.entries()), body: text };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui", color: "#fff" }}>
      <h2>Function Ping</h2>
      <div style={{ marginBottom: 8 }}>
        <div><b>VITE_SUPABASE_URL</b>: {url}</div>
        <div><b>Functions base</b>: {url ? `${url}/functions/v1` : "(missing URL)"}</div>
        <div><b>Computed functions URL</b>: {computedFnUrl}</div>
      </div>

      <button onClick={hitApproval} style={{ padding: 8, marginRight: 8 }}>Ping send-approval-email</button>
      <button onClick={hitRejection} style={{ padding: 8, marginRight: 8 }}>Ping send-rejection-email</button>
      <button onClick={async () => setApprovalResp(await rawFetchApproval())} style={{ padding: 8, marginRight: 8 }}>
        RAW fetch approval
      </button>
      <button onClick={async () => setRejectionResp(await rawFetchRejection())} style={{ padding: 8 }}>
        RAW fetch rejection
      </button>
      <button
        onClick={() => {
          const testEvent = new Error('Sentry test event from admin health page');

          Sentry.logger.info('Admin triggered Sentry test event', { action: 'test_event_button_click' });
          Sentry.metrics.count('test_counter', 1);
          Sentry.captureException(testEvent, {
            level: 'info',
            tags: {
              source: 'admin_health_page',
              handled: 'true',
            },
            extra: {
              action: 'test_event_button_click',
            },
          });
        }}
        style={{ padding: 8, marginLeft: 8, background: '#c00', color: '#fff', border: 'none', cursor: 'pointer' }}
      >
        Send Sentry test event
      </button>

      <div style={{ marginTop: 16 }}>
        <button
          onClick={runLocationBackfill}
          disabled={backfillRunning}
          style={{ padding: 8, background: '#0a6', color: '#fff', border: 'none', cursor: backfillRunning ? 'default' : 'pointer' }}
        >
          {backfillRunning ? 'Backfilling location data…' : 'Backfill IP location (25 users)'}
        </button>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4, maxWidth: 480 }}>
          Fills in city/region/country/timezone for existing users who already have an IP address
          on file but never got a location lookup. Uses their own admin login, not the anon key.
          Safe to click repeatedly — each run picks up the next 25 not-yet-looked-up rows.
        </p>
      </div>

      <pre style={{ background: "#111", color: "#0f0", padding: 12, marginTop: 12 }}>
{JSON.stringify({ headers, approvalResp, errA, rejectionResp, errR, backfillResp, errB }, null, 2)}
      </pre>
    </div>
  );
}