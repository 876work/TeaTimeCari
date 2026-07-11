-- Keep the profile mirror complete enough for admin-initiated identity edits.
-- registrations remains the KYC source of truth, while profiles supports app/SSO lookups.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

UPDATE public.profiles p
SET
  first_name = COALESCE(p.first_name, r."firstName"),
  last_name = COALESCE(p.last_name, r."lastName"),
  phone = COALESCE(p.phone, r.phone)
FROM public.registrations r
WHERE p.id = r.id;

CREATE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles (lower(username));
CREATE INDEX IF NOT EXISTS profiles_phone_idx ON public.profiles (phone) WHERE phone IS NOT NULL;
