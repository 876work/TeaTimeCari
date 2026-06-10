# Supabase password reset email template

The reset email must be pasted into Supabase as raw HTML, not as a Markdown fenced code block. If the template starts with ` ```html ` or ends with ` ``` `, mail clients will render those fence markers as visible text.

Use `supabase/templates/recovery.html` as the source for the hosted Supabase **Authentication → Email Templates → Reset Password** template.

## Branded reset link

The template uses a branded Tea Time Cari URL first:

`{{ .SiteURL }}/reset-password/verify?token_hash={{ .TokenHash }}&redirect_to={{ .RedirectTo | urlquery }}`

That page validates the token-bearing request and then sends the user to Supabase's `/auth/v1/verify` endpoint. Supabase still has to verify the recovery token, but users see a `teatimecari.app/reset-password/verify...` link in the email instead of a raw `*.supabase.co/auth/v1/verify...` link.

## Hosted Supabase deployment steps

1. Open the Supabase dashboard.
2. Go to **Authentication → Email Templates → Reset Password**.
3. Remove any leading ` ```html ` and trailing ` ``` ` fences from the template field.
4. Paste the raw contents of `supabase/templates/recovery.html`.
5. Set the subject to `Reset Your Tea Time Cari Password`.
6. Save the template and send a test reset email.

For local Supabase development, `supabase/config.toml` points the recovery template at `supabase/templates/recovery.html`.
