const allowedHeaders = [
  'authorization',
  'x-client-info',
  'apikey',
  'content-type',
  'x-supabase-api-version',
  'x-supabase-client',
  'x-supabase-auth',
  'x-region',
].join(', ');

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': allowedHeaders,
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
