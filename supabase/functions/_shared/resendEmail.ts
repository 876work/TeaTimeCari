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
  return Deno.env.get("RESEND_FROM_NAME")?.trim() || "Tea Time Cari";
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
  const subject = "Your Tea Time Cari Account is Under Review";
  const text = `${greeting}
Thanks for signing up for Tea Time Cari.
Your account has been received and is now under review. This helps us keep the community safer, more private, and more respectful for everyone.
You will receive an update within 48 hours.
Best regards,
Tea Time Cari Team`;

  const html = `<p>${greeting}</p><p>Thanks for signing up for Tea Time Cari.</p><p>Your account has been received and is now under review. This helps us keep the community safer, more private, and more respectful for everyone.</p><p>You will receive an update within 48 hours.</p><p>Best regards,<br/>Tea Time Cari Team</p>`;

  return sendResendEmail({ to, subject, html, text });
}

export async function sendApprovalEmail(to: string, firstName?: string): Promise<ResendEmailResult> {
  const greeting = buildGreeting(firstName);
  const subject = "Your Tea Time Cari Account has been Approved";
  const siteBaseUrl = getSiteBaseUrl();
  const loginUrl = `${siteBaseUrl}/login`;
  const privacyUrl = `${siteBaseUrl}/privacy-policy`;
  const termsUrl = `${siteBaseUrl}/terms-of-service`;
  const guidelinesUrl = `${siteBaseUrl}/community-guidelines`;

  const text = `${greeting}
Your Tea Time Cari account has been approved.
You can now log in here:
${loginUrl}
Tea Time Cari is built around privacy, respectful sharing, and community support. Please take a moment to review our Privacy Policy, Terms of Service, and Community Guidelines before participating.
Privacy Policy:
${privacyUrl}
Terms of Service:
${termsUrl}
Community Guidelines:
${guidelinesUrl}
Welcome to the community.
Best regards,
Tea Time Cari Team`;

  const html = `<p>${greeting}</p><p>Your Tea Time Cari account has been approved.</p><p>You can now log in here:<br/><a href="${loginUrl}">${loginUrl}</a></p><p>Tea Time Cari is built around privacy, respectful sharing, and community support. Please take a moment to review our Privacy Policy, Terms of Service, and Community Guidelines before participating.</p><p>Privacy Policy:<br/><a href="${privacyUrl}">${privacyUrl}</a></p><p>Terms of Service:<br/><a href="${termsUrl}">${termsUrl}</a></p><p>Community Guidelines:<br/><a href="${guidelinesUrl}">${guidelinesUrl}</a></p><p>Welcome to the community.</p><p>Best regards,<br/>Tea Time Cari Team</p>`;

  return sendResendEmail({ to, subject, html, text });
}

export async function sendRejectionEmail(to: string, firstName?: string): Promise<ResendEmailResult> {
  const greeting = buildGreeting(firstName);
  const subject = "Your Tea Time Cari Account was not Approved";

  const text = `${greeting}
Thank you for your interest in Tea Time Cari.
After reviewing your registration, we are unable to approve your account at this time.
To help protect the privacy and safety of the community, some registrations may not be approved if they do not meet our account review requirements.
Best regards,
Tea Time Cari Team`;

  const html = `<p>${greeting}</p><p>Thank you for your interest in Tea Time Cari.</p><p>After reviewing your registration, we are unable to approve your account at this time.</p><p>To help protect the privacy and safety of the community, some registrations may not be approved if they do not meet our account review requirements.</p><p>Best regards,<br/>Tea Time Cari Team</p>`;

  return sendResendEmail({ to, subject, html, text });
}

export async function sendSuspensionEmail(to: string, firstName?: string): Promise<ResendEmailResult> {
  const greeting = buildGreeting(firstName);
  const subject = "Your Tea Time Cari Account has been Suspended";

  const text = `${greeting}
Your Tea Time Cari account has been suspended.
This means you will not be able to log in or use the service at this time.
Tea Time Cari is built around privacy, respect, and community safety. Accounts may be suspended when activity goes against our community rules, Privacy Policy, or Terms of Service.
Best regards,
Tea Time Cari Team`;

  const html = `<p>${greeting}</p><p>Your Tea Time Cari account has been suspended.</p><p>This means you will not be able to log in or use the service at this time.</p><p>Tea Time Cari is built around privacy, respect, and community safety. Accounts may be suspended when activity goes against our community rules, Privacy Policy, or Terms of Service.</p><p>Best regards,<br/>Tea Time Cari Team</p>`;

  return sendResendEmail({ to, subject, html, text });
}

export async function sendUnsuspensionEmail(to: string, firstName?: string): Promise<ResendEmailResult> {
  const greeting = buildGreeting(firstName);
  const subject = "Your Tea Time Cari Account Access has been Restored";
  const loginUrl = `${getSiteBaseUrl()}/login`;

  const text = `${greeting}
Your Tea Time Cari account suspension has been removed.
You can now log in and use Tea Time Cari again.
Login here:
${loginUrl}
Please continue to follow the community rules and help keep Tea Time Cari private, respectful, and safe for everyone.
Best regards,
Tea Time Cari Team`;

  const html = `<p>${greeting}</p><p>Your Tea Time Cari account suspension has been removed.</p><p>You can now log in and use Tea Time Cari again.</p><p>Login here:<br/><a href="${loginUrl}">${loginUrl}</a></p><p>Please continue to follow the community rules and help keep Tea Time Cari private, respectful, and safe for everyone.</p><p>Best regards,<br/>Tea Time Cari Team</p>`;

  return sendResendEmail({ to, subject, html, text });
}
