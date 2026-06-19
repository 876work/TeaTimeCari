-- CreatorFlow currency, country, fee, and future conversion setup.
-- Prices are stored as numeric amounts plus ISO-like currency codes; formatted strings are not stored.

CREATE TABLE IF NOT EXISTS public.currencies (
  code text PRIMARY KEY,
  name text NOT NULL,
  symbol text,
  decimal_places integer NOT NULL DEFAULT 2,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT currencies_code_uppercase_chk CHECK (code = upper(code)),
  CONSTRAINT currencies_decimal_places_chk CHECK (decimal_places >= 0)
);

CREATE TABLE IF NOT EXISTS public.countries (
  code text PRIMARY KEY,
  name text NOT NULL,
  default_currency_code text REFERENCES public.currencies(code),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT countries_code_uppercase_chk CHECK (code = upper(code))
);

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.creator_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  price_amount numeric NOT NULL CHECK (price_amount >= 0),
  currency_code text NOT NULL REFERENCES public.currencies(code),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_service_id uuid REFERENCES public.creator_services(id) ON DELETE SET NULL,
  creator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  business_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  price_amount numeric NOT NULL CHECK (price_amount >= 0),
  currency_code text NOT NULL REFERENCES public.currencies(code),
  business_fee_amount numeric NOT NULL DEFAULT 0 CHECK (business_fee_amount >= 0),
  creator_fee_amount numeric NOT NULL DEFAULT 0 CHECK (creator_fee_amount >= 0),
  total_amount numeric NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  creator_net_amount numeric NOT NULL DEFAULT 0 CHECK (creator_net_amount >= 0),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  creator_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  gross_amount numeric NOT NULL CHECK (gross_amount >= 0),
  creator_fee_amount numeric NOT NULL DEFAULT 0 CHECK (creator_fee_amount >= 0),
  net_amount numeric NOT NULL CHECK (net_amount >= 0),
  currency_code text NOT NULL REFERENCES public.currencies(code),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.currency_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency_code text REFERENCES public.currencies(code),
  quote_currency_code text REFERENCES public.currencies(code),
  rate numeric NOT NULL CHECK (rate > 0),
  source text,
  rate_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT currency_rates_pair_date_key UNIQUE (base_currency_code, quote_currency_code, rate_date),
  CONSTRAINT currency_rates_distinct_codes_chk CHECK (base_currency_code <> quote_currency_code)
);

INSERT INTO public.currencies (code, name, symbol, decimal_places) VALUES
  ('XCD', 'East Caribbean Dollar', '$', 2),
  ('USD', 'US Dollar', '$', 2),
  ('JMD', 'Jamaican Dollar', '$', 2),
  ('TTD', 'Trinidad and Tobago Dollar', '$', 2),
  ('BBD', 'Barbadian Dollar', '$', 2),
  ('GYD', 'Guyanese Dollar', '$', 2),
  ('GBP', 'British Pound', '£', 2),
  ('CAD', 'Canadian Dollar', '$', 2)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  symbol = EXCLUDED.symbol,
  decimal_places = EXCLUDED.decimal_places,
  is_active = true,
  updated_at = now();

INSERT INTO public.countries (code, name, default_currency_code) VALUES
  ('LC', 'Saint Lucia', 'XCD'),
  ('JM', 'Jamaica', 'JMD'),
  ('TT', 'Trinidad and Tobago', 'TTD'),
  ('BB', 'Barbados', 'BBD'),
  ('GY', 'Guyana', 'GYD'),
  ('US', 'United States', 'USD'),
  ('CA', 'Canada', 'CAD'),
  ('GB', 'United Kingdom', 'GBP')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  default_currency_code = EXCLUDED.default_currency_code,
  is_active = true,
  updated_at = now();

INSERT INTO public.platform_settings (key, value, description) VALUES
  ('business_fee_percent', '10', 'Percent fee charged to businesses on top of creator service price.'),
  ('creator_fee_percent', '5', 'Percent fee deducted from creator gross payout.'),
  ('default_currency', 'XCD', 'Fallback currency code when a country-specific currency is unavailable.'),
  ('default_country', 'LC', 'Fallback country code for CreatorFlow launch defaults.')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();

-- Update existing feed-access payments table for marketplace currency architecture.
ALTER TABLE public.payments
  ALTER COLUMN amount TYPE numeric USING amount::numeric;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS currency_code text;

UPDATE public.payments
SET currency_code = upper(COALESCE(currency_code, currency, 'USD'))
WHERE currency_code IS NULL;

ALTER TABLE public.payments
  ALTER COLUMN currency_code SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_currency_code_fkey'
      AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_currency_code_fkey FOREIGN KEY (currency_code) REFERENCES public.currencies(code) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.payments VALIDATE CONSTRAINT payments_currency_code_fkey;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS business_fee_amount numeric DEFAULT 0;

-- Add required fields if these tables already existed before this migration with partial schemas.
ALTER TABLE public.creator_services ADD COLUMN IF NOT EXISTS price_amount numeric;
ALTER TABLE public.creator_services ADD COLUMN IF NOT EXISTS currency_code text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS price_amount numeric;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS currency_code text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS business_fee_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS creator_fee_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS total_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS creator_net_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS gross_amount numeric;
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS creator_fee_amount numeric DEFAULT 0;
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS net_amount numeric;
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS currency_code text;

UPDATE public.creator_services SET currency_code = 'XCD' WHERE currency_code IS NULL;
UPDATE public.creator_services SET price_amount = 0 WHERE price_amount IS NULL;
UPDATE public.bookings SET currency_code = 'XCD' WHERE currency_code IS NULL;
UPDATE public.bookings SET price_amount = 0 WHERE price_amount IS NULL;
UPDATE public.payouts SET currency_code = 'XCD' WHERE currency_code IS NULL;
UPDATE public.payouts SET gross_amount = 0 WHERE gross_amount IS NULL;
UPDATE public.payouts SET net_amount = gross_amount - COALESCE(creator_fee_amount, 0) WHERE net_amount IS NULL;

ALTER TABLE public.creator_services ALTER COLUMN price_amount SET NOT NULL;
ALTER TABLE public.creator_services ALTER COLUMN currency_code SET NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN price_amount SET NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN currency_code SET NOT NULL;
ALTER TABLE public.payouts ALTER COLUMN gross_amount SET NOT NULL;
ALTER TABLE public.payouts ALTER COLUMN net_amount SET NOT NULL;
ALTER TABLE public.payouts ALTER COLUMN currency_code SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creator_services_currency_code_fkey' AND conrelid = 'public.creator_services'::regclass) THEN
    ALTER TABLE public.creator_services ADD CONSTRAINT creator_services_currency_code_fkey FOREIGN KEY (currency_code) REFERENCES public.currencies(code) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_currency_code_fkey' AND conrelid = 'public.bookings'::regclass) THEN
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_currency_code_fkey FOREIGN KEY (currency_code) REFERENCES public.currencies(code) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payouts_currency_code_fkey' AND conrelid = 'public.payouts'::regclass) THEN
    ALTER TABLE public.payouts ADD CONSTRAINT payouts_currency_code_fkey FOREIGN KEY (currency_code) REFERENCES public.currencies(code) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.creator_services VALIDATE CONSTRAINT creator_services_currency_code_fkey;
ALTER TABLE public.bookings VALIDATE CONSTRAINT bookings_currency_code_fkey;
ALTER TABLE public.payouts VALIDATE CONSTRAINT payouts_currency_code_fkey;

CREATE OR REPLACE FUNCTION public.get_default_currency_for_country(country_code text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT c.default_currency_code
     FROM public.countries c
     WHERE c.code = upper(country_code)
       AND c.is_active = true),
    (SELECT ps.value FROM public.platform_settings ps WHERE ps.key = 'default_currency'),
    'XCD'
  );
$$;

CREATE OR REPLACE FUNCTION public.calculate_booking_amounts(price_amount numeric)
RETURNS TABLE (
  business_fee_amount numeric,
  creator_fee_amount numeric,
  total_amount numeric,
  creator_net_amount numeric
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  business_fee_percent numeric := COALESCE((SELECT value::numeric FROM public.platform_settings WHERE key = 'business_fee_percent'), 10);
  creator_fee_percent numeric := COALESCE((SELECT value::numeric FROM public.platform_settings WHERE key = 'creator_fee_percent'), 5);
BEGIN
  RETURN QUERY SELECT
    price_amount * business_fee_percent / 100,
    price_amount * creator_fee_percent / 100,
    price_amount + (price_amount * business_fee_percent / 100),
    price_amount - (price_amount * creator_fee_percent / 100);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_creator_service_default_currency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.currency_code IS NULL THEN
    NEW.currency_code := public.get_default_currency_for_country(
      COALESCE(NEW.country_code, (SELECT value FROM public.platform_settings WHERE key = 'default_country'), 'LC')
    );
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'creator_services' AND column_name = 'country_code'
  ) THEN
    DROP TRIGGER IF EXISTS set_creator_service_default_currency ON public.creator_services;
    CREATE TRIGGER set_creator_service_default_currency
      BEFORE INSERT ON public.creator_services
      FOR EACH ROW
      EXECUTE FUNCTION public.set_creator_service_default_currency();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_booking_amounts_from_service()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  service_currency text;
  amounts record;
BEGIN
  IF NEW.creator_service_id IS NOT NULL THEN
    SELECT currency_code INTO service_currency FROM public.creator_services WHERE id = NEW.creator_service_id;
    IF service_currency IS NOT NULL THEN
      NEW.currency_code := service_currency;
    END IF;
  END IF;

  SELECT * INTO amounts FROM public.calculate_booking_amounts(NEW.price_amount);
  NEW.business_fee_amount := amounts.business_fee_amount;
  NEW.creator_fee_amount := amounts.creator_fee_amount;
  NEW.total_amount := amounts.total_amount;
  NEW.creator_net_amount := amounts.creator_net_amount;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_booking_amounts_from_service ON public.bookings;
CREATE TRIGGER set_booking_amounts_from_service
  BEFORE INSERT OR UPDATE OF creator_service_id, price_amount ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_booking_amounts_from_service();

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_roles ar
    WHERE ar.user_id = auth.uid()
      AND ar.revoked_at IS NULL
      AND ar.role IN ('owner', 'admin')
  );
$$;

ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  managed_table text;
BEGIN
  FOREACH managed_table IN ARRAY ARRAY['currencies', 'countries', 'platform_settings', 'currency_rates'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Authenticated users can read ' || managed_table, managed_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Admins can manage ' || managed_table, managed_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Service role can manage ' || managed_table, managed_table);
  END LOOP;
END $$;

CREATE POLICY "Authenticated users can read currencies"
  ON public.currencies FOR SELECT TO authenticated
  USING (is_active = true);
CREATE POLICY "Admins can manage currencies"
  ON public.currencies FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY "Service role can manage currencies"
  ON public.currencies FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read countries"
  ON public.countries FOR SELECT TO authenticated
  USING (is_active = true);
CREATE POLICY "Admins can manage countries"
  ON public.countries FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY "Service role can manage countries"
  ON public.countries FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read platform_settings"
  ON public.platform_settings FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can manage platform_settings"
  ON public.platform_settings FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY "Service role can manage platform_settings"
  ON public.platform_settings FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read currency_rates"
  ON public.currency_rates FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can manage currency_rates"
  ON public.currency_rates FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY "Service role can manage currency_rates"
  ON public.currency_rates FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS countries_default_currency_code_idx ON public.countries(default_currency_code);
CREATE INDEX IF NOT EXISTS creator_services_currency_code_idx ON public.creator_services(currency_code);
CREATE INDEX IF NOT EXISTS bookings_currency_code_idx ON public.bookings(currency_code);
CREATE INDEX IF NOT EXISTS payments_currency_code_idx ON public.payments(currency_code);
CREATE INDEX IF NOT EXISTS payouts_currency_code_idx ON public.payouts(currency_code);
CREATE INDEX IF NOT EXISTS currency_rates_base_currency_code_idx ON public.currency_rates(base_currency_code);
CREATE INDEX IF NOT EXISTS currency_rates_quote_currency_code_idx ON public.currency_rates(quote_currency_code);
CREATE INDEX IF NOT EXISTS currency_rates_rate_date_idx ON public.currency_rates(rate_date);

DROP TRIGGER IF EXISTS update_currencies_updated_at ON public.currencies;
CREATE TRIGGER update_currencies_updated_at BEFORE UPDATE ON public.currencies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_countries_updated_at ON public.countries;
CREATE TRIGGER update_countries_updated_at BEFORE UPDATE ON public.countries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_platform_settings_updated_at ON public.platform_settings;
CREATE TRIGGER update_platform_settings_updated_at BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
