# CORS Configuration for Edge Functions

The `approve-and-sync` function responds to OPTIONS and echoes a single origin from ALLOWED_ORIGINS.

Browser requests must include Authorization: Bearer <access_token> from Supabase Auth (the admin session).

If the origin is not in ALLOWED_ORIGINS, the browser blocks the call and the Edge Function logs nothing.

## Setting Allowed Origins

Set/update allowed origins in Supabase:

```bash
supabase secrets set ALLOWED_ORIGINS="https://community.teatimecari.app,https://localhost:5173"
```

## Required Environment Variables

The following environment variables must be set in your Supabase project:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
- `DISCOURSE_BASE_URL`: Base URL of your Discourse forum
- `DISCOURSE_ADMIN_API_KEY`: Discourse admin API key
- `DISCOURSE_ADMIN_API_USERNAME`: Discourse API username (usually 'system')
- `DISCOURSE_MODE`: Set to "invite" or "create"
- `DISCOURSE_MALE_GROUP_ID`: Numeric ID of male users group
- `DISCOURSE_FEMALE_GROUP_ID`: Numeric ID of female users group
- `ALLOWED_ORIGINS`: Comma-separated list of allowed domains

Do not hardcode secrets anywhere in the repo.