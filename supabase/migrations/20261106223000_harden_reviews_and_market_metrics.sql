-- Harden review policies and business metric RPCs for BR/PY market isolation.
-- This migration is additive and preserves the existing metric RPC signature.
-- Apply only after validation in a separate development Supabase project.

BEGIN;

-- Reviews: approved reviews remain public across markets. Pending reviews are
-- visible to their author only when the reviewed business belongs to the
-- trusted market in app_metadata, or to the global administrator.
DROP POLICY IF EXISTS "Public read approved business reviews"
  ON public.business_reviews;

CREATE POLICY "Public read approved business reviews"
ON public.business_reviews
FOR SELECT
TO anon, authenticated
USING (
  business_reviews.status = 'approved'
  OR (
    business_reviews.user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.businesses AS b
      WHERE b.id = business_reviews.business_id
        AND b.country_code =
          (auth.jwt() -> 'app_metadata' ->> 'market_code')
    )
  )
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- A review can be submitted only for an approved business in the caller's
-- trusted market. The caller cannot choose another user's identity or status.
DROP POLICY IF EXISTS "Authenticated users submit pending business reviews"
  ON public.business_reviews;

CREATE POLICY "Authenticated users submit pending business reviews"
ON public.business_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  business_reviews.user_id = auth.uid()
  AND business_reviews.status = 'pending'
  AND EXISTS (
    SELECT 1
    FROM public.businesses AS b
    WHERE b.id = business_reviews.business_id
      AND b.status = 'approved'
      AND b.country_code =
        (auth.jwt() -> 'app_metadata' ->> 'market_code')
  )
);

-- Public counter endpoint: only the two supported metrics can be incremented,
-- and only approved businesses are counted. Explicit grants preserve the
-- intended anonymous visit/click tracking after removing PUBLIC execution.
CREATE OR REPLACE FUNCTION public.increment_business_metric(
  p_business_id uuid,
  p_metric text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  affected_rows integer;
BEGIN
  IF p_business_id IS NULL
     OR p_metric IS NULL
     OR p_metric NOT IN ('views_count', 'whatsapp_clicks') THEN
    RAISE EXCEPTION 'Métrica ou anúncio inválido'
      USING ERRCODE = '22023';
  END IF;

  IF p_metric = 'views_count' THEN
    UPDATE public.businesses
       SET views_count = pg_catalog.coalesce(views_count, 0) + 1
     WHERE id = p_business_id
       AND status = 'approved';
  ELSE
    UPDATE public.businesses
       SET whatsapp_clicks = pg_catalog.coalesce(whatsapp_clicks, 0) + 1
     WHERE id = p_business_id
       AND status = 'approved';
  END IF;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  IF affected_rows > 0 THEN
    INSERT INTO public.business_metric_events (business_id, metric)
    VALUES (p_business_id, p_metric);
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION
  public.increment_business_metric(uuid, text)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION
  public.increment_business_metric(uuid, text)
TO anon, authenticated, service_role;

-- Keep the existing admin RPC compatible with the current frontend, while
-- hardening its SECURITY DEFINER search_path and retaining its admin check.
CREATE OR REPLACE FUNCTION public.get_admin_business_metrics(p_month date)
RETURNS TABLE (
  business_id uuid,
  views_count bigint,
  whatsapp_clicks bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role')
     IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Acesso restrito à administração'
      USING ERRCODE = '42501';
  END IF;

  IF p_month IS NULL THEN
    RAISE EXCEPTION 'Informe o mês do relatório'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    e.business_id,
    pg_catalog.count(*) FILTER (
      WHERE e.metric = 'views_count'
    )::bigint,
    pg_catalog.count(*) FILTER (
      WHERE e.metric = 'whatsapp_clicks'
    )::bigint
  FROM public.business_metric_events AS e
  WHERE e.created_at >= p_month::timestamptz
    AND e.created_at < (p_month + INTERVAL '1 month')::timestamptz
  GROUP BY e.business_id;
END;
$function$;

REVOKE ALL ON FUNCTION
  public.get_admin_business_metrics(date)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION
  public.get_admin_business_metrics(date)
TO authenticated, service_role;

-- New market-aware admin RPC. NULL country_code means both markets; 'BR' or
-- 'PY' scopes the report. Only a global admin can call it.
CREATE OR REPLACE FUNCTION public.get_admin_business_metrics_by_market(
  p_month date,
  p_country_code text DEFAULT NULL
)
RETURNS TABLE (
  business_id uuid,
  country_code text,
  views_count bigint,
  whatsapp_clicks bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role')
     IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Acesso restrito à administração'
      USING ERRCODE = '42501';
  END IF;

  IF p_month IS NULL THEN
    RAISE EXCEPTION 'Informe o mês do relatório'
      USING ERRCODE = '22023';
  END IF;

  IF p_country_code IS NOT NULL
     AND p_country_code NOT IN ('BR', 'PY') THEN
    RAISE EXCEPTION 'Mercado inválido'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    e.business_id,
    b.country_code,
    pg_catalog.count(*) FILTER (
      WHERE e.metric = 'views_count'
    )::bigint,
    pg_catalog.count(*) FILTER (
      WHERE e.metric = 'whatsapp_clicks'
    )::bigint
  FROM public.business_metric_events AS e
  JOIN public.businesses AS b
    ON b.id = e.business_id
  WHERE e.created_at >= p_month::timestamptz
    AND e.created_at < (p_month + INTERVAL '1 month')::timestamptz
    AND (
      p_country_code IS NULL
      OR b.country_code = p_country_code
    )
  GROUP BY e.business_id, b.country_code;
END;
$function$;

REVOKE ALL ON FUNCTION
  public.get_admin_business_metrics_by_market(date, text)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION
  public.get_admin_business_metrics_by_market(date, text)
TO authenticated, service_role;

COMMIT;
