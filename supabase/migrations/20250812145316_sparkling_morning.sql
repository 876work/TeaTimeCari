/*
  # Create profiles table for Discourse SSO integration

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key, same as auth.users.id)
      - `email` (text, unique, not null)
      - `username` (text, not null)
      - `full_name` (text, nullable)
      - `kyc_status` (text, check constraint, default 'pending')
      - `gender` (text, check constraint, nullable until approved)
      - `xaccess` (boolean, default false for optional cross-gender access)
      - `approved_at` (timestamptz, nullable)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `profiles` table
    - Add policies for authenticated users to read/update their own data
    - Add policy for service role to manage all profiles
    - Add trigger to update `updated_at` timestamp

  3. Constraints
    - Check constraint for kyc_status values
    - Check constraint for gender values
    - Unique constraint on email
</sql>

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  username text NOT NULL,
  full_name text,
  kyc_status text CHECK (kyc_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  gender text CHECK (gender IN ('men', 'women')),
  xaccess boolean DEFAULT false,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can manage all profiles"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Index for performance
CREATE INDEX IF NOT EXISTS profiles_kyc_status_idx ON profiles(kyc_status);
CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email);
CREATE INDEX IF NOT EXISTS profiles_approved_at_idx ON profiles(approved_at);