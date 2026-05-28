export type ResendEmailResult = {
  success: boolean;
  id?: string;
  error?: string;
};

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

const RESEND_API_URL = "https://api.resend.com/emails";

function getFromName(): string {
  return Deno.env.get("RESEND_FROM_NAME")?.trim() || "TeaTime Cari";
}

function buildGreeting(firstName?: string): string {
  const cleanName = firstName?.trim();
  return cleanName ? `Hi ${cleanName},` : "Hello,";
}

async function sendResendEmail({ to, subject, html, text }: SendEmailInput): Promise<ResendEmailResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL")?.trim();
  const fromName = getFromName();

  if (!apiKey) {
    return { success: false, error: "Missing RESEND_API_KEY" };
  }

  if (!fromEmail) {
    return { success: false, error: "Missing RESEND_FROM_EMAIL" };
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  const responseJson = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof responseJson?.message === "string"
      ? responseJson.message
      : `Resend API error (${response.status})`;

    return { success: false, error: message };
  }

  return { success: true, id: responseJson?.id };
}

export async function sendUnderReviewEmail(to: string, firstName?: string): Promise<ResendEmailResult> {
  const greeting = buildGreeting(firstName);
  const subject = "Your TeaTime Cari account is under review";
  const text = `${greeting}\n\nYour account is currently under review. Your account will be approved or rejected within 48 hours.\n\nBest regards,\nTeaTime Cari`;
  const html = `<p>${greeting}</p><p>Your account is currently under review. Your account will be approved or rejected within 48 hours.</p><p>Best regards,<br/>TeaTime Cari</p>`;

  return sendResendEmail({ to, subject, html, text });
}

export async function sendApprovalEmail(to: string, firstName?: string): Promise<ResendEmailResult> {
  const greeting = buildGreeting(firstName);
  const subject = "Your TeaTime Cari account has been approved";
  const text = `${greeting}\n\nYour account has been approved. You can now log in and access the community.\n\nBest regards,\nTeaTime Cari`;
  const html = `<p>${greeting}</p><p>Your account has been approved. You can now log in and access the community.</p><p>Best regards,<br/>TeaTime Cari</p>`;

  return sendResendEmail({ to, subject, html, text });
}

export async function sendRejectionEmail(to: string, firstName?: string, reason?: string): Promise<ResendEmailResult> {
  const greeting = buildGreeting(firstName);
  const subject = "Your TeaTime Cari account was not approved";
  const cleanReason = reason?.trim();
  const reasonText = cleanReason ? `\n\nReason: ${cleanReason}` : "";
  const reasonHtml = cleanReason ? `<p><strong>Reason:</strong> ${cleanReason}</p>` : "";

  const text = `${greeting}\n\nYour account was not approved at this time.${reasonText}\n\nBest regards,\nTeaTime Cari`;
  const html = `<p>${greeting}</p><p>Your account was not approved at this time.</p>${reasonHtml}<p>Best regards,<br/>TeaTime Cari</p>`;

  return sendResendEmail({ to, subject, html, text });
}
