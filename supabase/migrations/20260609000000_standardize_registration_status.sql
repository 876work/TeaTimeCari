-- Standardize Tea Time Cari account lifecycle vocabulary.
-- Legacy React flows used `verified` for the same access-granted state now
-- represented everywhere as `approved`.
UPDATE public.registrations
SET status = 'approved'
WHERE lower(status) = 'verified';
