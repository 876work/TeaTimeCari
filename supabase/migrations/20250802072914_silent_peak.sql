/*
  # Create invite codes system

  1. New Tables
    - `invite_codes`
      - `id` (uuid, primary key)
      - `code` (text, unique) - the actual invite code
      - `created_by` (uuid) - user who created the code
      - `usage_limit` (integer) - max number of uses
      - `usage_count` (integer) - current usage count
      - `is_active` (boolean) - whether code is active
      - `expires_at` (timestamp) - expiration date
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `invite_codes` table
    - Add policies for reading and updating invite codes

  3. Changes
    - Add `invite_code_used` column to registrations table to track which code was used
*/

-- Create invite_codes table
CREATE TABLE IF NOT EXISTS public.invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  usage_limit integer DEFAULT 10 NOT NULL,
  usage_count integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- Policy for anyone to read active invite codes (for validation)
CREATE POLICY "Anyone can read active invite codes for validation"
  ON public.invite_codes
  FOR SELECT
  TO authenticated
  USING (is_active = true AND expires_at > now());

-- Policy for service role to update invite codes (for usage tracking)
CREATE POLICY "Service role can update invite codes"
  ON public.invite_codes
  FOR UPDATE
  TO service_role
  USING (true);

-- Add invite_code_used column to registrations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'registrations' AND column_name = 'invite_code_used'
  ) THEN
    ALTER TABLE public.registrations ADD COLUMN invite_code_used text;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS invite_codes_code_idx ON public.invite_codes (code);
CREATE INDEX IF NOT EXISTS invite_codes_active_idx ON public.invite_codes (is_active, expires_at);

-- Insert some sample invite codes for testing
INSERT INTO public.invite_codes (code, usage_limit, created_by) VALUES
  ('WELCOME2024', 100, NULL),
  ('BETA_ACCESS', 50, NULL),
  ('FRIENDS_ONLY', 25, NULL)
ON CONFLICT (code) DO NOTHING;