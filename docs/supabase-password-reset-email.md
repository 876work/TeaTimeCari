# Supabase password reset email template

The reset email must be pasted into Supabase as raw HTML, not as a Markdown fenced code block. If code fence markers are included, mail clients render them as visible text above and below the message.

Use `supabase/templates/recovery.html` as the source for the hosted Supabase **Authentication → Email Templates → Reset Password** template. The first line of the pasted template should be `<!doctype html>`.

## Branded reset link

The template uses a branded Tea Time Cari URL first:

`{{ .SiteURL }}/reset-password/verify?confirmation_url={{ .ConfirmationURL | urlquery }}`

That page validates the Supabase-generated `{{ .ConfirmationURL }}` and shows a Tea Time Cari continue button that points to Supabase's `/auth/v1/verify` endpoint. Supabase still verifies the one-time recovery token, but users see a `teatimecari.app/reset-password/verify...` link in the email instead of a raw `*.supabase.co/auth/v1/verify...` link.

Do not rebuild Supabase's verification URL from `{{ .TokenHash }}` in the email template. Use `{{ .ConfirmationURL }}` exactly so Supabase keeps the right token format for the active auth flow.

## Hosted Supabase deployment steps

1. Open the Supabase dashboard.
2. Go to **Authentication → Email Templates → Reset Password**.
3. Select everything currently in the template field and delete it, including any code fence markers.
4. Paste the raw contents of `supabase/templates/recovery.html`.
5. Confirm the first characters in the field are `<!doctype html>`.
6. Set the subject to `Reset Your Tea Time Cari Password`.
7. Save the template and send a new test reset email. Existing reset emails may already have consumed or expired one-time tokens, so always test with a fresh reset email after saving.

You can also update the hosted template with:

`SUPABASE_ACCESS_TOKEN=... PROJECT_REF=... npm run supabase:update-recovery-template`

For local Supabase development, `supabase/config.toml` points the recovery template at `supabase/templates/recovery.html`.
