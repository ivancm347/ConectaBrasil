-- ConectaBrasil: preparação do bucket privado de imagens.
-- Este arquivo configura somente colunas e bucket.
-- NÃO crie policies de storage aqui: as regras de acesso são mantidas
-- exclusivamente pelas migrations versionadas abaixo:
--   20261106120000_secure_business_image_ownership.sql
--   20261106150000_secure_business_image_storage_policies.sql
-- Executar scripts antigos de policies depois dessas migrations pode
-- reintroduzir regras mais permissivas e desfazer o isolamento.

alter table public.businesses
  add column if not exists logo_url text,
  add column if not exists gallery_urls text[] not null default '{}';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-images',
  'business-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = excluded.allowed_mime_types;

-- As policies de SELECT/INSERT/UPDATE/DELETE e a função
-- public.can_view_business_image são criadas e protegidas pelas migrations
-- indicadas acima. Não duplicar nem substituir essas definições neste arquivo.
