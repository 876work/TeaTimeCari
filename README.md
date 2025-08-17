TeaTimeCari

## Setup

Create a `.env` file with your Supabase credentials:

```bash
VITE_SUPABASE_URL=<project url>
VITE_SUPABASE_ANON_KEY=<anon key>

# Optional: override the functions endpoint (useful for local Supabase)
VITE_SUPABASE_FUNCTIONS_URL=<functions url>
```

If `VITE_SUPABASE_FUNCTIONS_URL` is not provided, the app will fall back to
`${VITE_SUPABASE_URL}/functions/v1`.
