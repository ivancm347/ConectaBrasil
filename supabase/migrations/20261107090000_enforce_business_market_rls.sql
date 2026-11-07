-- ConectaBrasil: reforço de isolamento dos anúncios por mercado.
-- Esta migração substitui as políticas permissivas legadas de businesses e
-- business_categories por um conjunto fechado e explícito.
--
-- IMPORTANTE:
-- 1. Executar primeiro o diagnóstico supabase/diagnostico_pre_migracao_rls_readonly.sql.
-- 2. Configurar e testar o Custom Access Token Hook e app_metadata.market_code
--    em contas BR/PY antes de aplicar em produção.
-- 3. Não habilitar PY enquanto os testes com usuários reais de cada mercado
--    não confirmarem que proprietários não acessam/alteram anúncios alheios.
--
-- Anúncios aprovados continuam públicos (como já eram); a vitrine filtra o país.
-- Dados pendentes/restritos e operações de proprietário ficam limitados ao
-- market_code confiável de app_metadata. A rota/localStorage não é autoridade.
--
-- Migração transacional e idempotente. Não altera nem remove registros.

BEGIN;

DO $$
DECLARE
  p record;
BEGIN
  -- Remove todas as policies anteriores dessas duas tabelas para impedir que
  -- uma policy permissiva antiga continue liberando acesso por OR.
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('businesses', 'business_categories')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      p.policyname, p.schemaname, p.tablename
    );
  END LOOP;
END
$$;

-- BUSINESSES ---------------------------------------------------------------

CREATE POLICY "Market public read approved businesses"
ON public.businesses
FOR SELECT
TO anon, authenticated
USING (status = 'approved');

CREATE POLICY "Owners read own businesses in assigned market"
ON public.businesses
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  AND country_code = (auth.jwt() -> 'app_metadata' ->> 'market_code')
);

CREATE POLICY "Global admins read all businesses"
ON public.businesses
FOR SELECT
TO authenticated
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Owners create pending businesses in assigned market"
ON public.businesses
FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND status = 'pending'
  AND featured = false
  AND country_code = (auth.jwt() -> 'app_metadata' ->> 'market_code')
  AND country_code IN ('BR', 'PY')
);

CREATE POLICY "Owners update own businesses in assigned market"
ON public.businesses
FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid()
  AND country_code = (auth.jwt() -> 'app_metadata' ->> 'market_code')
  AND status IN ('pending', 'approved')
)
WITH CHECK (
  owner_id = auth.uid()
  AND country_code = (auth.jwt() -> 'app_metadata' ->> 'market_code')
  AND country_code IN ('BR', 'PY')
  AND status = 'pending'
  AND featured = false
);

CREATE POLICY "Owners delete own pending businesses in assigned market"
ON public.businesses
FOR DELETE
TO authenticated
USING (
  owner_id = auth.uid()
  AND country_code = (auth.jwt() -> 'app_metadata' ->> 'market_code')
  AND status = 'pending'
);

CREATE POLICY "Global admins manage all businesses"
ON public.businesses
FOR ALL
TO authenticated
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- BUSINESS_CATEGORIES ------------------------------------------------------

CREATE POLICY "Public read categories of approved businesses"
ON public.business_categories
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.businesses AS b
    WHERE b.id = business_id
      AND b.status = 'approved'
  )
);

CREATE POLICY "Owners read categories in assigned market"
ON public.business_categories
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.businesses AS b
    WHERE b.id = business_id
      AND b.owner_id = auth.uid()
      AND b.country_code = (auth.jwt() -> 'app_metadata' ->> 'market_code')
  )
);

CREATE POLICY "Global admins read all business categories"
ON public.business_categories
FOR SELECT
TO authenticated
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Owners manage categories on own pending businesses in assigned market"
ON public.business_categories
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.businesses AS b
    WHERE b.id = business_id
      AND b.owner_id = auth.uid()
      AND b.status = 'pending'
      AND b.country_code = (auth.jwt() -> 'app_metadata' ->> 'market_code')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.businesses AS b
    WHERE b.id = business_id
      AND b.owner_id = auth.uid()
      AND b.status = 'pending'
      AND b.country_code = (auth.jwt() -> 'app_metadata' ->> 'market_code')
  )
);

CREATE POLICY "Global admins manage all business categories"
ON public.business_categories
FOR ALL
TO authenticated
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

COMMIT;
