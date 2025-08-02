```sql
-- Add RLS policy to allow public read access for username availability check
CREATE POLICY "Allow public read access for username availability check"
ON public.registrations
FOR SELECT
USING (true);
```