/*
  # Fix invite codes RLS policy for registration

  1. Security Changes
    - Drop existing restrictive RLS policy on invite_codes table
    - Create new policy allowing anonymous users to read active invite codes
    - This enables invite code validation during registration (before authentication)

  2. Policy Details
    - Allows SELECT operations for all users (including anonymous)
    - Only applies to active codes that haven't expired
    - Maintains security by not exposing inactive or expired codes
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Anyone can read active invite codes for validation" ON public.invite_codes;

-- Create new policy that allows anonymous users to read active invite codes
CREATE POLICY "Allow anonymous access to active invite codes"
ON public.invite_codes FOR SELECT
USING ((is_active = true) AND (expires_at > now()));

-- Keep the service role policy for updates
DROP POLICY IF EXISTS "Service role can update invite codes" ON public.invite_codes;

CREATE POLICY "Service role can update invite codes"
ON public.invite_codes FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);