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
const FROM_EMAIL = "noreply@teatimecari.app";
const FROM_NAME = "Tea Time Cari";
const SUPPORT_EMAIL = "hello@teatimecari.app";

function buildGreeting(firstName?: string): string {
  const cleanName = firstName?.trim();
  return cleanName ? `Hi ${cleanName},` : "Hello,";
}

function getSiteBaseUrl(): string {
  return (Deno.env.get("SITE_BASE_URL")?.trim() || "https://teatimecari.app").replace(/\/+$/, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getEmailFooterText(): string {
  return `\nFollow us:
Instagram: https://www.instagram.com/teatimecari
Facebook: https://www.facebook.com/people/Tea-Time-Cari/61590153702836/
WhatsApp: https://whatsapp.com/channel/0029VbDJhU46hENxsvU7ZM16

Need help?
${SUPPORT_EMAIL}`;
}

function getEmailFooterHtml(): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:16px auto 16px auto;">
<tr>
<td align="center" style="padding:0 8px;">
<a href="https://www.instagram.com/teatimecari" target="_blank" style="display:inline-block; text-decoration:none;">
<img src="https://cdn.simpleicons.org/instagram/d96e8a" alt="Instagram" width="22" height="22" style="display:block; width:22px; height:22px; border:0;" />
</a>
</td>
<td align="center" style="padding:0 8px;">
<a href="https://www.facebook.com/people/Tea-Time-Cari/61590153702836/" target="_blank" style="display:inline-block; text-decoration:none;">
<img src="https://cdn.simpleicons.org/facebook/5ca4c8" alt="Facebook" width="22" height="22" style="display:block; width:22px; height:22px; border:0;" />
</a>
</td>
<td align="center" style="padding:0 8px;">
<a href="https://whatsapp.com/channel/0029VbDJhU46hENxsvU7ZM16" target="_blank" style="display:inline-block; text-decoration:none;">
<img src="https://cdn.simpleicons.org/whatsapp/25D366" alt="WhatsApp Channel" width="22" height="22" style="display:block; width:22px; height:22px; border:0;" />
</a>
</td>
<td align="center" style="padding:0 8px;">
<a href="mailto:${SUPPORT_EMAIL}" style="display:inline-block; text-decoration:none;">
<img src="https://img.icons8.com/ios-filled/50/6b7280/new-post.png" alt="Email" width="22" height="22" style="display:block; width:22px; height:22px; border:0;" />
</a>
</td>
</tr>
</table>
<p style="margin:0 0 12px 0; font-size:12px; line-height:1.6; color:#9ca3af;">
Follow us on <a href="https://www.instagram.com/teatimecari" target="_blank" style="color:#6b7280; text-decoration:underline;">Instagram</a>, <a href="https://www.facebook.com/people/Tea-Time-Cari/61590153702836/" target="_blank" style="color:#6b7280; text-decoration:underline;">Facebook</a>, and <a href="https://whatsapp.com/channel/0029VbDJhU46hENxsvU7ZM16" target="_blank" style="color:#6b7280; text-decoration:underline;">WhatsApp</a>.
</p>
<p style="margin:0; font-size:12px; line-height:1.6; color:#9ca3af;">
Need help? Email us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#6b7280; text-decoration:underline;">
${SUPPORT_EMAIL}
</a>
</p>`;
}

async function sendResendEmail({ to, subject, html, text }: SendEmailInput): Promise<ResendEmailResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();

  if (!apiKey) {
    return { success: false, error: "Missing RESEND_API_KEY" };
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
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
Tea Time Cari Team${getEmailFooterText()}`;

  const html = `<p>${greeting}</p><p>Thanks for signing up for Tea Time Cari.</p><p>Your account has been received and is now under review. This helps us keep the community safer, more private, and more respectful for everyone.</p><p>You will receive an update within 48 hours.</p><p>Best regards,<br/>Tea Time Cari Team</p><hr style="border:none; border-top:1px solid #f1f5f9; margin:24px 0;">${getEmailFooterHtml()}`;

  return sendResendEmail({ to, subject, html, text });
}

export async function sendApprovalEmail(to: string, firstName?: string): Promise<ResendEmailResult> {
  const greeting = buildGreeting(firstName);
  const subject = "Your Tea Time Cari Account has been Approved";
  const loginUrl = `${getSiteBaseUrl()}/login`;

  const text = `${greeting}
Your Tea Time Cari account has been approved.
You can now log in here:
${loginUrl}
Welcome to the community.
Best regards,
Tea Time Cari Team${getEmailFooterText()}`;

  const html = `<p>${greeting}</p><p>Your Tea Time Cari account has been approved.</p><p style="margin: 24px 0; text-align: center;"><a href="${loginUrl}" style="display: inline-block; background: #2563eb; border-radius: 12px; color: #ffffff; font-size: 16px; font-weight: 700; padding: 14px 28px; text-decoration: none;">Log in to Tea Time Cari</a></p><p>Welcome to the community.</p><p>Best regards,<br/>Tea Time Cari Team</p><hr style="border:none; border-top:1px solid #f1f5f9; margin:24px 0;">${getEmailFooterHtml()}`;

  return sendResendEmail({ to, subject, html, text });
}

export async function sendRejectionEmail(to: string, firstName?: string, reason?: string): Promise<ResendEmailResult> {
  const greeting = buildGreeting(firstName);
  const subject = "Your Tea Time Cari Account was not Approved";
  const supportUrl = `${getSiteBaseUrl()}/contact-us?topic=account-status`;

  const cleanReason = reason?.trim();
  const hasReason = Boolean(cleanReason) && cleanReason!.toLowerCase() !== "no reason provided";

  const reasonTextBlock = hasReason ? `\nReason provided by our review team: ${cleanReason}\n` : "";
  const reasonHtmlBlock = hasReason ? `<p><strong>Reason provided by our review team:</strong> ${escapeHtml(cleanReason!)}</p>` : "";

  const text = `${greeting}
Thank you for your interest in Tea Time Cari.
After reviewing your registration, we are unable to approve your account at this time.
${reasonTextBlock}To help protect the privacy and safety of the community, some registrations may not be approved if they do not meet our account review requirements.
If you have questions about this decision or would like to follow up, contact us here:
${supportUrl}
Best regards,
Tea Time Cari Team${getEmailFooterText()}`;

  const html = `<p>${greeting}</p><p>Thank you for your interest in Tea Time Cari.</p><p>After reviewing your registration, we are unable to approve your account at this time.</p>${reasonHtmlBlock}<p>To help protect the privacy and safety of the community, some registrations may not be approved if they do not meet our account review requirements.</p><p>If you have questions about this decision or would like to follow up, <a href="${supportUrl}">contact our support team</a>.</p><p>Best regards,<br/>Tea Time Cari Team</p><hr style="border:none; border-top:1px solid #f1f5f9; margin:24px 0;">${getEmailFooterHtml()}`;

  return sendResendEmail({ to, subject, html, text });
}

export async function sendInviteEmail(to: string): Promise<ResendEmailResult> {
  const subject = "You're Invited to Tea Time Cari";
  const signupUrl = `${getSiteBaseUrl()}/signup`;

  const text = `Hello,

You're invited to join Tea Time Cari.

Tea Time Cari is a private Caribbean community where members can share experiences, compare notes, and stay informed before getting deeper involved with someone.

It helps you find out if you may be dating the same partner by allowing members to share responsibly and get real community feedback.

Create your account here:
${signupUrl}

Share. Compare. Stay informed.${getEmailFooterText()}

Best regards,
Tea Time Cari Team`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta content="width=device-width" name="viewport" />
<meta name="x-apple-disable-message-reformatting" />
<meta content="IE=edge" http-equiv="X-UA-Compatible" />
<meta content="telephone=no,address=no,email=no,date=no,url=no" name="format-detection" />
<title>You're Invited to Tea Time Cari</title>
</head>
<body style="margin:0; padding:0; background-color:#f8f4f7; font-family:Arial, Helvetica, sans-serif; color:#172033;">
<div style="display:none; overflow:hidden; line-height:1px; opacity:0; max-height:0; max-width:0;">
You're invited to join Tea Time Cari.
</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f8f4f7; margin:0; padding:32px 16px;">
<tr>
<td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px; background-color:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 10px 30px rgba(23,32,51,0.08);">
<tr>
<td style="padding:32px 28px 18px 28px; text-align:center; background:linear-gradient(135deg, #fde7ef 0%, #e8f4ff 100%);">
<a href="https://teatimecari.app/" target="_blank" style="display:inline-block; text-decoration:none;">
<img src="https://teatimecari.app/teaLogo.png" alt="Tea Time Cari" width="170" style="display:block; margin:0 auto 10px auto; max-width:170px; height:auto; border:0; outline:none; text-decoration:none;" />
</a>
<p style="margin:8px 0 0 0; font-size:14px; color:#4b5563;">
Share. Compare. Stay informed.
</p>
</td>
</tr>
<tr>
<td style="padding:32px 28px 8px 28px;">
<p style="margin:0 0 12px 0; font-size:13px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#d96e8a;">
Private Community Invitation
</p>
<h2 style="margin:0 0 16px 0; font-size:24px; line-height:1.3; color:#172033;">
You're invited to join Tea Time Cari
</h2>
<p style="margin:0 0 16px 0; font-size:16px; line-height:1.6; color:#374151;">
Hello,
</p>
<p style="margin:0 0 16px 0; font-size:16px; line-height:1.6; color:#374151;">
Tea Time Cari is a private Caribbean community where members can share experiences, compare notes, and stay informed before getting deeper involved with someone.
</p>
<p style="margin:0 0 24px 0; font-size:16px; line-height:1.6; color:#374151;">
The platform helps you find out if you may be dating the same partner by allowing members to share responsibly and get real community feedback.
</p>
<p style="margin:0 0 24px 0; font-size:15px; line-height:1.6; color:#6b7280;">
Tea Time Cari is built around privacy, trust, and responsible sharing. Create your account to request access and join the community.
</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 12px 0;">
<tr>
<td align="center" style="border-radius:999px; background:linear-gradient(135deg, #d96e8a 0%, #5ca4c8 100%);">
<a href="${signupUrl}" target="_blank" style="display:inline-block; padding:14px 28px; font-size:16px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:999px;"
>
Create Your Account
</a>
</td>
</tr>
</table>
<p style="margin:0 0 28px 0; font-size:13px; line-height:1.6; color:#6b7280;">
If the button does not work, copy and paste this link into your browser:
<br />
<a href="${signupUrl}" target="_blank" style="color:#d96e8a; text-decoration:underline; word-break:break-all;">
${signupUrl}
</a>
</p>
<p style="margin:0 0 24px 0; font-size:16px; line-height:1.6; color:#374151;">
Best regards,<br />
Tea Time Cari Team
</p>
</td>
</tr>
<tr>
<td style="padding:24px 28px 32px 28px; text-align:center; border-top:1px solid #f1f5f9;">
<p style="margin:0 0 16px 0; font-size:12px; line-height:1.5; color:#9ca3af;">
This email was sent because you were invited to join Tea Time Cari.
</p>
${getEmailFooterHtml()}
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;

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
Tea Time Cari Team${getEmailFooterText()}`;

  const html = `<p>${greeting}</p><p>Your Tea Time Cari account has been suspended.</p><p>This means you will not be able to log in or use the service at this time.</p><p>Tea Time Cari is built around privacy, respect, and community safety. Accounts may be suspended when activity goes against our community rules, Privacy Policy, or Terms of Service.</p><p>Best regards,<br/>Tea Time Cari Team</p><hr style="border:none; border-top:1px solid #f1f5f9; margin:24px 0;">${getEmailFooterHtml()}`;

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
Tea Time Cari Team${getEmailFooterText()}`;

  const html = `<p>${greeting}</p><p>Your Tea Time Cari account suspension has been removed.</p><p>You can now log in and use Tea Time Cari again.</p><p>Login here:<br/><a href="${loginUrl}">${loginUrl}</a></p><p>Please continue to follow the community rules and help keep Tea Time Cari private, respectful, and safe for everyone.</p><p>Best regards,<br/>Tea Time Cari Team</p><hr style="border:none; border-top:1px solid #f1f5f9; margin:24px 0;">${getEmailFooterHtml()}`;

  return sendResendEmail({ to, subject, html, text });
}
