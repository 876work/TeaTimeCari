import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const computedFnUrl = url ? `${url.replace(/\/+$/, '')}/functions/v1` : "(missing URL)";

const supabase = createClient(url, anon);

export default function FunctionPing() {
  const [approvalResp, setApprovalResp] = useState<any>(null);
  const [rejectionResp, setRejectionResp] = useState<any>(null);
  const [errA, setErrA] = useState<any>(null);
  const [errR, setErrR] = useState<any>(null);

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

  return (
    <div style={{ padding: 16, fontFamily: "system-ui" }}>
      <h2>Function Ping</h2>
      <div style={{ marginBottom: 8 }}>
        <div><b>VITE_SUPABASE_URL</b>: {url}</div>
        <div><b>Functions base</b>: {url ? `${url}/functions/v1` : "(missing URL)"}</div>
      </div>

      <button onClick={hitApproval} style={{ padding: 8, marginRight: 8 }}>Ping send-approval-email</button>
      <button onClick={hitRejection} style={{ padding: 8 }}>Ping send-rejection-email</button>

      <pre style={{ background: "#111", color: "#0f0", padding: 12, marginTop: 12 }}>
{JSON.stringify({ headers, approvalResp, errA, rejectionResp, errR }, null, 2)}
      </pre>
      <div><b>Computed functions URL</b>: {computedFnUrl}</div>
    </div>
  );
}