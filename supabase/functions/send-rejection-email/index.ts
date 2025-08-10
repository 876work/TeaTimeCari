import { corsHeaders } from "../_shared/cors.ts";

async function sendEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
  const apiKey = Deno.env.get("SENDGRID_API_KEY");
  const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL");
  if (!apiKey) throw new Error("Missing SENDGRID_API_KEY");
  if (!fromEmail) throw new Error("Missing SENDGRID_FROM_EMAIL");

  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: fromEmail },
    subject,
    content: [{ type: "text/plain", value: text }],
  };

  const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`SendGrid ${resp.status}: ${body}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, firstName, reason, dryRun } = await req.json();

    if (!email || !firstName) throw new Error("Missing required fields: email, firstName");

    const subject = "Your account has been rejected";
    const text = `Hi ${firstName},

We're sorry, but your account didn't meet our requirements.
Reason: ${reason ?? "Not specified"}

If you have questions, reply to this email.

Regards,
The Team`;

    if (dryRun) {
      return new Response(
        JSON.stringify({ success: true, dryRun: true, preview: { to: email, subject, text } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await sendEmail({ to: email, subject, text });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[edge-fn] rejection email error:", err?.message || err);
    return new Response(
      JSON.stringify({ success: false, error: String(err?.message || err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});