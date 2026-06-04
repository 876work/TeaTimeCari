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

function getSiteBaseUrl(): string {
  return (Deno.env.get("SITE_BASE_URL")?.trim() || "https://teatimecari.app").replace(/\/+$/, "");
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
  const text = `${greeting}

Thanks for signing up for TeaTime Cari. Your account is currently under review, and you will receive a response within 48 hours.

Best regards,
TeaTime Cari`;

  const html = `<p>${greeting}</p><p>Thanks for signing up for TeaTime Cari. Your account is currently under review, and you will receive a response within 48 hours.</p><p>Best regards,<br/>TeaTime Cari</p>`;

  return sendResendEmail({ to, subject, html, text });
}

export async function sendApprovalEmail(to: string, firstName?: string): Promise<ResendEmailResult> {
  const greeting = buildGreeting(firstName);
  const subject = "Your TeaTime Cari account has been approved";
  const siteBaseUrl = getSiteBaseUrl();
  const loginUrl = `${siteBaseUrl}/login`;
  const privacyUrl = `${siteBaseUrl}/privacy-policy`;
  const termsUrl = `${siteBaseUrl}/terms-of-service`;

  const text = `${greeting}

Your account has been approved. You can now log in here: ${loginUrl}

Please be respectful at all times while participating in the community. Please also review our Privacy Policy (${privacyUrl}) and Terms of Service (${termsUrl}).

Best regards,
TeaTime Cari`;

  const html = `<p>${greeting}</p><p>Your account has been approved. You can now log in here: <a href="${loginUrl}">${loginUrl}</a></p><p>Please be respectful at all times while participating in the community. Please also review our <a href="${privacyUrl}">Privacy Policy</a> and <a href="${termsUrl}">Terms of Service</a>.</p><p>Best regards,<br/>TeaTime Cari</p>`;

  return sendResendEmail({ to, subject, html, text });
}

export async function sendRejectionEmail(to: string, firstName?: string): Promise<ResendEmailResult> {
  const greeting = buildGreeting(firstName);
  const subject = "Your TeaTime Cari account was not approved";

  const text = `${greeting}

We are unable to approve your account at this time.

Best regards,
TeaTime Cari`;

  const html = `<p>${greeting}</p><p>We are unable to approve your account at this time.</p><p>Best regards,<br/>TeaTime Cari</p>`;

  return sendResendEmail({ to, subject, html, text });
}

export async function sendSuspensionEmail(to: string, firstName?: string): Promise<ResendEmailResult> {
  const greeting = buildGreeting(firstName);
  const subject = "Your TeaTime Cari account has been suspended";

  const text = `${greeting}

Your TeaTime Cari account has been suspended. You will not be able to log in or use the service at this time.

Best regards,
TeaTime Cari`;

  const html = `<p>${greeting}</p><p>Your TeaTime Cari account has been suspended. You will not be able to log in or use the service at this time.</p><p>Best regards,<br/>TeaTime Cari</p>`;

  return sendResendEmail({ to, subject, html, text });
}

export async function sendUnsuspensionEmail(to: string, firstName?: string): Promise<ResendEmailResult> {
  const greeting = buildGreeting(firstName);
  const subject = "Your TeaTime Cari account suspension has been removed";
  const loginUrl = `${getSiteBaseUrl()}/login`;

  const text = `${greeting}

Your account suspension has been removed. You can now log in and use TeaTime Cari again.

Login here: ${loginUrl}

Best regards,
TeaTime Cari`;

  const html = `<p>${greeting}</p><p>Your account suspension has been removed. You can now log in and use TeaTime Cari again.</p><p>Login here: <a href="${loginUrl}">${loginUrl}</a></p><p>Best regards,<br/>TeaTime Cari</p>`;

  return sendResendEmail({ to, subject, html, text });
}