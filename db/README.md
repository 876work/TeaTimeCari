# DB Migrations

This repository tracks our Discourse SSO/KYC profiles table.

- `db/migrations/001_profiles.sql` **drops** `public.profiles` if it exists and recreates it. Use for fresh environments only.
- Production was already updated via Supabase SQL Editor; this file is here for version control and to bootstrap staging/local.

## Applying
- **Prod (manual):** Paste SQL into Supabase → Database → SQL editor, run.
- **Local/Stage:** Run the SQL via your preferred tool (Supabase CLI or psql).

## Future changes
Do **not** edit `001_profiles.sql`. For updates, add `002_*.sql` with ALTER TABLE statements (non-destructive), plus any new policies/indexes.