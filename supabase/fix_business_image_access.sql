-- SCRIPT DESCONTINUADO — NÃO EXECUTAR.
--
-- Esta versão antiga recriava can_view_business_image sem validar:
--   1. se a primeira pasta corresponde ao proprietário real do anúncio;
--   2. se o proprietário autenticado pertence ao mercado do anúncio;
--   3. se as policies de upload/alteração/exclusão validam o anúncio associado.
--
-- Executá-la depois das migrations de segurança pode reabrir acesso indevido.
-- A implementação mantida está em:
--   supabase/migrations/20261106150000_secure_business_image_storage_policies.sql
--
-- Este bloco falha intencionalmente e não altera função, policy, bucket ou dados.

DO $$
BEGIN
  RAISE EXCEPTION
    'Script descontinuado. Não execute. Consulte supabase/migrations/20261106150000_secure_business_image_storage_policies.sql e valide primeiro em ambiente Supabase de desenvolvimento.';
END
$$;
