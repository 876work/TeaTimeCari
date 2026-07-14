# Discourse groups and category permissions

This is the internal operating guide for Tea Time Cari's Discourse privacy
boundaries. It documents how Supabase Edge Functions assign Discourse groups,
how Discourse categories must be permissioned, and how administrators should
handle exceptional access without breaking gender-based privacy.

Related reference: [`docs/discourse-sso-identity.md`](./discourse-sso-identity.md)
explains the stable `external_id` requirement that keeps a Supabase registration
linked to the same Discourse account.

## Security goal

Approved members should only be able to read and participate in the private
community area that matches their approved gender group unless an administrator
explicitly grants cross-access. Discourse permissions are the enforcement layer;
frontend redirects and links are convenience only.

## System of record

| Concern | System of record | Notes |
| --- | --- | --- |
| User identity | Supabase `registrations.id` / `profiles.id` | Sent to Discourse as the permanent SSO `external_id`. |
| Approved gender group | Supabase registration/profile gender fields | Normalized to `men` or `women` before Discourse sync. |
| Cross-access eligibility | Supabase `xaccess` boolean, when used by the sync path | Adds the configured cross-access group in addition to the user's base gender group. |
| Discourse group membership | SSO `add_groups` / `remove_groups` payloads | Built from Supabase secrets by Edge Functions. |
| Category visibility and posting | Discourse category security settings | Must be configured manually in Discourse admin. |
| Staff/moderation powers | Discourse admin/moderator flags plus optional groups | Should not be used as a substitute for member category groups. |

## Group names and Edge Function secrets

The shared Discourse SSO helper builds a comma-separated `add_groups` value from
these Supabase Edge Function secrets:

| Secret | Production value | Code fallback | Purpose |
| --- | --- | --- | --- |
| `MEN_GROUP` | `men-slu` | `men` | Base group for approved men. |
| `WOMEN_GROUP` | `women-slu` | `women` | Base group for approved women. |
| `XACCESS_GROUP` | `xaccess` | none | Optional group for approved cross-access. |

Operational requirements:

- Set the production group secrets explicitly in Supabase. Do not rely on code
  fallbacks outside local development.
- The Discourse group slugs must match the secret values exactly.
- Do not reuse these groups for staff, test accounts, marketing lists, or public
  announcements.
- Do not replace these secrets with numeric group IDs. The current SSO sync code
  sends Discourse group names/slugs, not IDs.
- Keep `MEN_GROUP` and `WOMEN_GROUP` mutually exclusive for ordinary members.
  A user should not be in both base groups unless this has been approved as an
  emergency exception and documented.

## Recommended Discourse groups

| Group | Who belongs | Managed by | Discourse visibility |
| --- | --- | --- | --- |
| `men-slu` | Approved users whose approved group is men | Supabase SSO sync | Private; only admins/moderators should be able to inspect membership. |
| `women-slu` | Approved users whose approved group is women | Supabase SSO sync | Private; only admins/moderators should be able to inspect membership. |
| `xaccess` | Users explicitly approved for cross-access or subscription access | Supabase SSO sync or documented admin exception | Private; membership requires a ticket/audit note. |
| `ttc-community-moderators` | Non-admin moderators who need category moderation visibility | Discourse admins | Private staff-facing group. |
| Discourse built-in `staff` / `moderators` | Trusted operational staff | Discourse admins | Managed through Discourse staff controls, not through normal member SSO. |

If the live Discourse site already uses different moderator group names, record
them in the Discourse admin runbook and keep category settings functionally
equivalent to the model below.

## Category permission design

Discourse category security should use group permissions as the hard boundary.
The table below is the intended model for private member categories.

| Category | Group with `See` | Group with `Reply` | Group with `Create` | Staff/moderator access | Notes |
| --- | --- | --- | --- | --- | --- |
| Men private category, e.g. `/c/user-photos/men-photos-slu/...` | `men-slu` | `men-slu` | `men-slu` | Discourse `staff`, Discourse `moderators`, and/or `ttc-community-moderators` | Remove broad groups such as `everyone`, `trust_level_0`, and `users`. |
| Women private category, e.g. `/c/user-photos/women-photos-slu/...` | `women-slu` | `women-slu` | `women-slu` | Discourse `staff`, Discourse `moderators`, and/or `ttc-community-moderators` | Remove broad groups such as `everyone`, `trust_level_0`, and `users`. |
| Cross-access category, if separate | `xaccess` plus any relevant base group approved by policy | `xaccess` | `xaccess` | Discourse `staff`, Discourse `moderators`, and/or `ttc-community-moderators` | Only create this category if product policy requires a shared/private cross-access area. |
| Public/help category, if any | Public or logged-in users as product policy allows | Usually logged-in users or staff only | Staff or approved users only | Staff | Must not contain private member disclosures. |

Minimum category checklist:

1. In Discourse Admin, open the category's **Security** settings.
2. Remove `everyone`, `trust_level_0`, `trust_level_1`, and `users` from private
   categories unless a written exception has been approved.
3. Add only the intended member group with the needed permissions:
   - Men category: `men-slu` can see, reply, and create.
   - Women category: `women-slu` can see, reply, and create.
4. Add moderator/staff groups only if they need moderation visibility.
5. Save, then test with one approved men account, one approved women account,
   and one account with no private group.
6. Record the date, tester accounts, and category permission screenshot/link in
   the admin change log.

## Visibility, posting, and reply rules

| User state | Men category | Women category | Cross-access-only category | Notes |
| --- | --- | --- | --- | --- |
| Not logged in | No access | No access | No access | Private categories must not appear in discovery, search, or direct URL access. |
| Logged in but not approved | No access | No access | No access | SSO should route unapproved users to KYC pending, but Discourse permissions remain the backstop. |
| Approved `men-slu` member | See, create, reply | No access | No access unless also `xaccess` and category grants it | User should not see women category names, topics, search hits, or notifications. |
| Approved `women-slu` member | No access | See, create, reply | No access unless also `xaccess` and category grants it | User should not see men category names, topics, search hits, or notifications. |
| Approved member with `xaccess` | Base category access plus only the cross-access categories configured for `xaccess` | Base category access plus only the cross-access categories configured for `xaccess` | See/reply/create only where category security grants `xaccess` | `xaccess` is additive; it must not automatically imply both base groups. |
| Discourse moderator/admin | Access as needed for moderation | Access as needed for moderation | Access as needed for moderation | Staff access is operational and should be limited to trusted staff. |
| Suspended user | No participation; visibility follows Discourse suspension behavior | No participation; visibility follows Discourse suspension behavior | No participation | Prefer suspension/removal over ad hoc category permission edits. |

## Cross-access rules

Cross-access is sensitive because it can bridge otherwise separate private
spaces. Use these rules for all `xaccess` grants:

- Cross-access must be approved through a documented product, subscription,
  safety, or support decision.
- `XACCESS_GROUP` membership is additive. It should not remove the user's base
  `men-slu` or `women-slu` membership.
- A user with `xaccess` should only see categories whose Discourse security
  explicitly grants `xaccess`. Do not add `xaccess` to both base private
  categories unless leadership has approved that exact behavior in writing.
- Before enabling `xaccess` on a category, document whether members may read
  only, reply, or create topics there. Prefer the least privilege that satisfies
  the need.
- When cross-access expires, remove the Supabase `xaccess` flag and trigger a
  Discourse sync. If manually changed in Discourse, also remove the user from
  the `xaccess` group and record the action.

## Moderator and staff groups

Moderation access must be explicit and separate from normal member membership.

- Use Discourse built-in admin/moderator roles for trusted operators who need
  broad operational access.
- If volunteer or limited moderators should only moderate private categories,
  create a dedicated private group such as `ttc-community-moderators` and grant
  it only the category permissions it needs.
- Moderators should not use personal member accounts to bypass privacy boundaries.
  If a moderator also participates as a member, assign only the member group that
  matches their approved member identity, plus staff permissions needed for work.
- Review Discourse admins, moderators, API keys, and category-specific moderator
  groups at least monthly and after any staff departure.

## Admin change procedure

Use this procedure before changing Discourse group names, category security, SSO
secrets, or a member's access group.

1. Open a ticket or admin log entry with the reason for the change.
2. Identify the affected Discourse groups, categories, and Supabase secrets.
3. Confirm the Supabase registration/profile gender and `xaccess` value for any
   affected user.
4. Make the smallest possible change:
   - Prefer updating Supabase and re-running SSO sync for member access.
   - Prefer Discourse category security changes for category behavior.
   - Avoid direct manual group edits unless responding to an incident or fixing
     a sync failure.
5. Test with accounts from both base groups and with a no-access account.
6. Add evidence to the ticket/admin log: who changed it, when, why, and what was
   verified.

## Emergency access and incident response

Emergency access may be required for safety investigations, legal response,
urgent moderation, or a broken production configuration. Follow least privilege
and document every action.

### Grant emergency access

1. Confirm the incident owner and approval from an owner/admin.
2. Prefer granting a Discourse moderator/admin role or the dedicated moderator
   group to a trusted staff account instead of adding the staff member to
   `men-slu`, `women-slu`, or `xaccess`.
3. If a member must receive temporary cross-access, add the access through the
   Supabase source of record when possible. If Discourse must be edited manually,
   add only the minimum group/category permission required.
4. Set an expiration time before granting access.
5. Record the user, group/category, reason, approver, exact time granted, and
   planned removal time.

### Revoke and verify emergency access

1. Remove the temporary Discourse role/group/category permission.
2. Restore Supabase `xaccess` or gender fields if they were temporarily changed.
3. Trigger or wait for a Discourse SSO sync and verify group membership.
4. Test direct URLs to the protected categories with the affected account if safe
   to do so.
5. Close the incident with screenshots or copied permission summaries showing the
   final state.

### Privacy boundary incident checklist

If a user can see, search, receive notifications for, post in, or reply in the
wrong private category:

1. Remove the user's incorrect group membership or suspend the account while
   investigating.
2. Check Discourse category security for broad groups such as `everyone`,
   `trust_level_0`, `trust_level_1`, or `users`.
3. Check Supabase registration/profile gender and `xaccess` values.
4. Check the user's Discourse group memberships and last SSO sync event.
5. Rotate or disable any compromised Discourse admin API key if unauthorized
   changes are suspected.
6. Preserve logs and notify leadership before making broad permission changes.
7. After containment, run the category test matrix from this document.

## Test matrix after any permission change

Use known test accounts that are approved but do not contain real sensitive
content. Verify direct category URLs, the Discourse sidebar/category list,
search, topic creation, replies, and notifications where practical.

| Test account | Expected result |
| --- | --- |
| Approved men account | Can see/create/reply in the men category; cannot discover women private content. |
| Approved women account | Can see/create/reply in the women category; cannot discover men private content. |
| Approved men account with `xaccess` | Keeps men access and gains only explicitly configured `xaccess` category permissions. |
| Approved women account with `xaccess` | Keeps women access and gains only explicitly configured `xaccess` category permissions. |
| Logged-in unapproved account | Cannot see private categories and is routed to KYC pending from SSO. |
| Anonymous browser | Cannot see private categories or private topic metadata. |
| Moderator/staff account | Can access only the categories needed for moderation duties. |

## Current implementation touchpoints

- `supabase/functions/_shared/sso.ts` builds `MEN_GROUP`, `WOMEN_GROUP`, and
  optional `XACCESS_GROUP` into Discourse SSO `add_groups`.
- `supabase/functions/approve-and-sync/index.ts` uses the shared helper during
  approval-time Discourse sync.
- `supabase/functions/sso-complete/index.ts` uses the shared helper during login
  completion, currently without cross-access.
- `supabase/functions/admin-update-user-profile/index.ts` removes the previous
  base gender group when an admin changes a user's gender and syncs the new
  group assignment.
- `src/pages/CommunityRedirect.tsx` contains frontend category paths for user
  convenience. These paths do not enforce privacy; Discourse category security
  does.
