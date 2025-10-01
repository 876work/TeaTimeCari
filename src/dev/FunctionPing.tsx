import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function FunctionPing() {
  const [approvalResp, setApprovalResp] = useState<any>(null);
  const [rejectionResp, setRejectionResp] = useState<any>(null);
  const [errA, setErrA] = useState<any>(null);
  const [errR, setErrR] = useState<any>(null);

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
    } catch (e:any) {
      setErrA({ message: e?.message || String(e) });
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
    } catch (e:any) {
      setErrR({ message: e?.message || String(e) });
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
    } catch (e: any) {
      return { error: e?.message || String(e) };
    }
  }

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
    } catch (e: any) {
      return { error: e?.message || String(e) };
    }
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui" }}>
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

      <pre style={{ background: "#111", color: "#0f0", padding: 12, marginTop: 12 }}>
{JSON.stringify({ headers, approvalResp, errA, rejectionResp, errR }, null, 2)}
      </pre>
    </div>
  );
}