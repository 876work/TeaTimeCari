/*
  # Create code_sends table for email verification tracking

  1. New Tables
    - `code_sends`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to registrations)
      - `code` (text, the verification code sent)
      - `sent_at` (timestamp, when the code was sent)
      - `delivery_status` (text, success/failed/simulated)
      - `error_message` (text, nullable, error details if failed)

  2. Security
    - Enable RLS on `code_sends` table
    - Add policy for authenticated users to read their own code send logs
    - Add policy for service role to insert code send logs

  3. Indexes
    - Add index on user_id for efficient queries
    - Add index on sent_at for time-based queries
*/

CREATE TABLE IF NOT EXISTS code_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  sent_at timestamptz DEFAULT now(),
  delivery_status text NOT NULL,
  error_message text,
  CONSTRAINT code_sends_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES registrations(id) 
    ON DELETE CASCADE
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS code_sends_user_id_idx ON code_sends(user_id);
CREATE INDEX IF NOT EXISTS code_sends_sent_at_idx ON code_sends(sent_at DESC);

-- Enable RLS
ALTER TABLE code_sends ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own code send logs
CREATE POLICY "Users can read own code sends"
  ON code_sends
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow service role to insert code send logs
CREATE POLICY "Service role can insert code sends"
  ON code_sends
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Allow service role to read all code sends (for admin purposes)
CREATE POLICY "Service role can read all code sends"
  ON code_sends
  FOR SELECT
  TO service_role
  USING (true);