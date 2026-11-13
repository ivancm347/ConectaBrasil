-- Public storefront reads are scoped to the market selected by the URL.
-- The header only selects which already-public approved listings to display.
-- It is NOT an authorization claim and is never used for owner writes or private data.
-- Signed app_metadata.market_code remains authoritative for owner operations.

DROP POLICY IF EXISTS "Approved businesses are public" ON public.businesses;
DROP POLICY IF EXISTS "Market public read approved businesses" ON public.businesses;

CREATE POLICY "Market public read approved businesses"
ON public.businesses
FOR SELECT
TO anon, authenticated
USING (
  status = 'approved'
  AND country_code = COALESCE(
    NULLIF(current_setting('request.headers', true)::json ->> 'x-market-code', ''),
    auth.jwt() -> 'app_metadata' ->> 'market_code'
  )
  AND country_code IN ('BR', 'PY')
);
