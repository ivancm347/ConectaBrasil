-- CONECTABRASIL: diagnóstico final antes da migração integrada de segurança.
-- SOMENTE LEITURA: não cria, altera ou remove objetos/dados.
-- Executar no SQL Editor do Supabase e compartilhar os resultados em texto.
-- Não inclui conteúdo de anúncios, dados pessoais, tokens ou credenciais.

-- 1) Policies efetivamente instaladas nas tabelas que serão protegidas.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename in
  ('businesses','business_categories','business_reviews','business_metric_events','admin_audit_logs'))
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

-- 2) RLS ativo/forçado nas tabelas relevantes.
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where (n.nspname = 'public' and c.relname in
  ('businesses','business_categories','business_reviews','business_metric_events','admin_audit_logs'))
   or (n.nspname = 'storage' and c.relname = 'objects')
order by 1,2;

-- 3) Definição e propriedades das funções de autorização/métricas/imagens.
select p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer, p.provolatile as volatility,
       pg_get_userbyid(p.proowner) as owner,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'can_view_business_image',
    'increment_business_metric',
    'get_admin_business_metrics',
    'custom_access_token_hook'
  )
order by p.proname;

-- 4) Grants EXECUTE dessas funções.
select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where specific_schema = 'public'
  and routine_name in (
    'can_view_business_image',
    'increment_business_metric',
    'get_admin_business_metrics',
    'custom_access_token_hook'
  )
order by routine_name, grantee, privilege_type;

-- 5) Colunas necessárias para confirmar compatibilidade com o frontend e métricas.
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('businesses','business_categories','business_reviews',
                     'business_metric_events','admin_audit_logs')
order by table_name, ordinal_position;

-- 6) Bucket e políticas do Storage (sem listar nomes/caminhos de arquivos).
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'business-images';

-- 7) Confirmação de existência do contexto de mercado em JWT/app_metadata
-- O SQL Editor costuma usar postgres sem JWT; isso é esperado. Não é teste de sessão.
select current_user as database_role,
       auth.uid() as auth_user_id,
       auth.jwt() -> 'app_metadata' ->> 'role' as app_role,
       auth.jwt() -> 'app_metadata' ->> 'market_code' as app_market_code,
       auth.jwt() ->> 'market_code' as top_level_market_code;

-- 8) Contagem de anúncios por país/status, sem expor conteúdo.
select country_code, status, count(*) as total
from public.businesses
group by country_code, status
order by country_code, status;
