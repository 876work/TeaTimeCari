import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export const supabaseAdmin = createClient(url, serviceKey, { 
  auth: { 
    autoRefreshToken: false, 
    persistSession: false 
  } 
});