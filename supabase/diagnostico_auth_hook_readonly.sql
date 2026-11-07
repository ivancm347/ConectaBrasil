-- CONECTABRASIL: diagnóstico somente leitura do Custom Access Token Hook.
-- Execute no SQL Editor do Supabase. Este arquivo contém apenas SELECT.
-- Não ativa/desativa hooks, não cria funções e não altera usuários, políticas ou dados.
-- Atenção: o SQL Editor executa com seu próprio contexto; não simula o JWT de um usuário.

-- 1) Verifica se existe uma função candidata ao hook no schema public.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as result_type,
  l.lanname as language,
  p.prosecdef as security_definer,
  pg_get_userbyid(p.proowner) as function_owner,
  has_function_privilege('supabase_auth_admin', p.oid, 'EXECUTE') as auth_admin_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where n.nspname = 'public'
  and p.proname in ('custom_access_token_hook', 'custom_access_token')
order by p.proname;

-- 2) Confirma se a role interna usada pelo Auth existe.
select rolname
from pg_roles
where rolname = 'supabase_auth_admin';

-- 3) Resume somente a presença de metadados de mercado em auth.users.raw_app_meta_data.
-- No banco, o nome da coluna é raw_app_meta_data (não app_metadata).
-- Não retorna IDs, e-mails ou conteúdo integral dos metadados.
select
  coalesce(raw_app_meta_data ->> 'market_code', '<não definido>') as market_code,
  coalesce(raw_app_meta_data ->> 'role', '<não definido>') as app_role,
  count(*) as accounts_count
from auth.users
group by 1, 2
order by 1, 2;

-- 4) IMPORTANTE: o SQL não informa com segurança se o hook está habilitado no Auth.
-- No Dashboard do Supabase, conferir Authentication > Hooks > Custom Access Token.
-- Registrar apenas: habilitado/desabilitado e nome da função selecionada.
-- Não copiar tokens, chaves, segredos ou dados pessoais para o chat.
