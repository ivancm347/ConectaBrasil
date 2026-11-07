-- CONECTA: diagnóstico somente leitura para preparar a separação BR/PY
-- Seguro para executar no SQL Editor do Supabase: contém apenas SELECT.
-- Não retorna registros de clientes/anúncios nem credenciais; consulta metadados.
-- Copie os resultados de cada bloco para revisão. Não compartilhe chaves ou tokens.

-- 1) Tabelas públicas existentes.
select table_schema, table_name
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
order by table_name;

-- 2) Colunas das tabelas relevantes para negócios, planos, avaliações,
-- métricas, categorias e administração.
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'businesses',
    'categories',
    'business_categories',
    'business_reviews',
    'business_metric_events',
    'admin_audit_logs'
  )
order by table_name, ordinal_position;

-- 3) Restrições e chaves estrangeiras das tabelas relevantes.
select
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name as referenced_table,
  ccu.column_name as referenced_column
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on tc.constraint_schema = kcu.constraint_schema
 and tc.constraint_name = kcu.constraint_name
left join information_schema.constraint_column_usage ccu
  on tc.constraint_schema = ccu.constraint_schema
 and tc.constraint_name = ccu.constraint_name
where tc.constraint_schema = 'public'
  and tc.table_name in (
    'businesses',
    'categories',
    'business_categories',
    'business_reviews',
    'business_metric_events',
    'admin_audit_logs'
  )
order by tc.table_name, tc.constraint_type, tc.constraint_name;

-- 4) Políticas RLS instaladas atualmente nas tabelas públicas.
select schemaname, tablename, policyname, permissive, roles,
       cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 5) Estado RLS das tabelas públicas.
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;

-- 6) Buckets existentes (metadados, sem listar arquivos).
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by id;

-- 7) Políticas instaladas no Storage.
select schemaname, tablename, policyname, permissive, roles,
       cmd, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by policyname;

-- 8) Funções relacionadas a métricas e administração.
select n.nspname as schema_name,
       p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_function_result(p.oid) as result_type,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'increment_business_metric',
    'get_admin_business_metrics'
  )
order by p.proname;
