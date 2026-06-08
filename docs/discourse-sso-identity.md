# Discourse SSO identity stability

Tea Time Cari uses DiscourseConnect to authenticate approved users into the
community forum. Every SSO payload that we sign for Discourse includes an
`external_id` value.

## Current source of `external_id`

The `external_id` is the Supabase registration/user identifier:

- Login-time Discourse SSO sends `profile.id`.
- The `/sso-complete` Edge Function sends `profile.id`.
- Approval-time Discourse pre-sync sends `reg.id`.

These values must refer to the same durable Supabase registration row for the
same human user.

## Permanence requirement

**Supabase registration/user IDs must never be regenerated, rotated, rewritten,
or replaced for the same user.** Treat the ID that backs DiscourseConnect
`external_id` as a permanent cross-system identity key.

DiscourseConnect uses `external_id` to look up the associated Discourse user.
If we issue a different `external_id` for the same person, Discourse can fail to
find the existing association and may only fall back to matching by email in
specific existing-user flows. That fallback is conditional and must not be relied
on for normal identity continuity.

## Operational guidance

- Do not delete and recreate a registration row to fix a user account; update the
  existing row instead.
- Do not migrate users into new Supabase IDs unless the matching Discourse SSO
  association is migrated in the same maintenance window.
- If a data repair or import requires changing registration IDs, stop and write a
  migration plan that preserves each user's Discourse `external_id` mapping.
- Keep `profile.id` and `reg.id` stable across auth, KYC approval, SSO login, and
  approval-time Discourse sync paths.
