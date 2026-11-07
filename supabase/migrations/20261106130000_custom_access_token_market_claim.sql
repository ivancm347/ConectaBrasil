-- ConectaBrasil: Custom Access Token Hook.
-- Preparado na branch de desenvolvimento; NÃO aplicar em produção ainda.
-- A função apenas copia market_code de app_metadata (gerenciado pelo servidor)
-- para uma claim de primeiro nível. Não consulta rota, localStorage ou user_metadata.
-- Sem market_code BR/PY válido, a claim não é emitida.
-- Não usa SECURITY DEFINER nem acessa tabelas.

begin;

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  claims jsonb;
  trusted_app_metadata jsonb;
  trusted_market_code text;
begin
  claims := coalesce(event -> 'claims', '{}'::jsonb);
  trusted_app_metadata := coalesce(claims -> 'app_metadata', '{}'::jsonb);
  trusted_market_code := trusted_app_metadata ->> 'market_code';

  -- Descarta qualquer valor de mesmo nome que não venha de app_metadata.
  claims := claims - 'market_code';

  if trusted_market_code in ('BR', 'PY') then
    claims := pg_catalog.jsonb_set(
      claims,
      '{market_code}',
      pg_catalog.to_jsonb(trusted_market_code),
      true
    );
  end if;

  return pg_catalog.jsonb_build_object('claims', claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;

commit;

-- Antes de habilitar no Dashboard:
-- 1. Confirmar a função e permissões no projeto de desenvolvimento.
-- 2. Atribuir market_code somente por processo administrativo confiável.
-- 3. Testar emissão/renovação de JWT e políticas RLS com contas de teste.
-- 4. Não habilitar PY enquanto os testes de isolamento BR/PY não passarem.
