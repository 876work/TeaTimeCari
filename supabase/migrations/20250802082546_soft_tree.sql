/*
  # Create Admin User

  1. New User Account
    - Creates admin user with email: admin@teatimecari.com
    - Password: Kuyana@13
    - Email confirmation disabled for immediate access

  2. User Registration Record
    - Creates corresponding registration record with verified status
    - Sets up admin profile with required fields

  3. Security
    - Admin user is immediately verified and active
    - Can access admin features based on email domain check
*/

-- Create admin user account in auth.users
-- Note: This uses Supabase's auth.users table directly
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@teatimecari.com',
  crypt('Kuyana@13', gen_salt('bf')),
  now(),
  now(),
  now(),
  '',
  '',
  '',
  ''
) ON CONFLICT (email) DO NOTHING;

-- Get the admin user ID for the registration record
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Get the admin user ID
  SELECT id INTO admin_user_id 
  FROM auth.users 
  WHERE email = 'admin@teatimecari.com';

  -- Create registration record for admin user
  INSERT INTO registrations (
    id,
    firstName,
    lastName,
    email,
    phone,
    username,
    gender,
    captureType,
    imageData,
    status,
    created_at,
    invite_code_used
  ) VALUES (
    admin_user_id,
    'System',
    'Administrator',
    'admin@teatimecari.com',
    '7581234567',
    'admin_user',
    'Male',
    'selfie',
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMzIiIGZpbGw9IiNGM0Y0RjYiLz4KPHN2ZyB4PSIxNiIgeT0iMTYiIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2QjczODAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj4KPHBhdGggZD0iTTIwIDIxdi0yYTQgNCAwIDAgMC00LTRIOGE0IDQgMCAwIDAtNCA0djIiLz4KPGNpcmNsZSBjeD0iMTIiIGN5PSI3IiByPSI0Ii8+Cjwvc3ZnPgo8L3N2Zz4K',
    'verified',
    now(),
    'ADMIN_SYSTEM'
  ) ON CONFLICT (email) DO UPDATE SET
    status = 'verified',
    firstName = 'System',
    lastName = 'Administrator';

END $$;