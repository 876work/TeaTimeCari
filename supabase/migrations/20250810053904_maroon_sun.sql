/*
  # Add KYC columns to registrations table

  1. New Columns
    - `kyc_code_hash` (text) - Hashed verification code for KYC process
    - `kyc_token_hash` (text) - Hashed token for KYC session management
    - `kyc_expires_at` (timestamptz) - Expiration timestamp for KYC verification
    - `kyc_verified_at` (timestamptz) - Timestamp when KYC was completed

  2. Indexes
    - Add index on `kyc_token_hash` for efficient token lookups

  3. Notes
    - All columns are nullable to maintain compatibility with existing records
    - KYC fields are added to the existing registrations table for simplicity
*/

-- Add KYC fields to registrations table
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS kyc_code_hash text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS kyc_token_hash text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS kyc_expires_at timestamptz;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS kyc_verified_at timestamptz;

-- Create index for efficient token lookups
CREATE INDEX IF NOT EXISTS idx_reg_kyc_token_hash ON public.registrations (kyc_token_hash);