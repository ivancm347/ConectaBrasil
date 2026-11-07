-- DIAGNÓSTICO SOMENTE LEITURA: contexto de autorização de mercado.
-- Execute no SQL Editor do ambiente de desenvolvimento; não altera dados ou políticas.
-- O SQL Editor normalmente usa contexto postgres e não representa um visitante real.
-- Para validar claims reais, executar também via sessão de teste anon/authenticated.

select
  current_user as database_role,
  session_user as session_role,
  auth.uid() as auth_user_id,
  coalesce(auth.jwt() ->> 'role', '<ausente>') as jwt_role,
  coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '<ausente>') as app_role,
  coalesce(auth.jwt() -> 'app_metadata' ->> 'market_code', '<ausente>') as trusted_market_code,
  coalesce(auth.jwt() -> 'user_metadata' ->> 'market_code', '<ausente>') as user_metadata_market_code,
  coalesce(auth.jwt() ->> 'iss', '<ausente>') as jwt_issuer;

-- Confirma se a coluna country_code já existe, sem alterar o schema.
select
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'businesses'
      and column_name = 'country_code'
  ) as country_code_column_exists;

-- Lista políticas RLS atuais nas tabelas relevantes.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'businesses',
    'business_reviews',
    'business_categories',
    'business_metric_events'
  )
order by tablename, policyname;

-- Lista políticas do bucket de imagens.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by policyname;
