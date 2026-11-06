-- CONECTA: reforça a propriedade dos arquivos de imagem.
-- Cada objeto deve estar associado a um anúncio existente do próprio usuário.
-- Mantém o bucket privado e não altera nem remove arquivos existentes.
-- Esta migração NÃO implementa isolamento por país: isso depende do contexto
-- de país confiável e da coluna country_code, ainda não aplicados em produção.
-- Revisar em ambiente de desenvolvimento antes de aplicar em produção.

begin;

drop policy if exists "Owners upload business images" on storage.objects;
drop policy if exists "Owners update business images" on storage.objects;
drop policy if exists "Owners delete business images" on storage.objects;

create policy "Owners upload business images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'business-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.businesses b
    where b.id::text = (storage.foldername(name))[2]
      and b.owner_id = auth.uid()
  )
);

create policy "Owners update business images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'business-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.businesses b
    where b.id::text = (storage.foldername(name))[2]
      and b.owner_id = auth.uid()
  )
)
with check (
  bucket_id = 'business-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.businesses b
    where b.id::text = (storage.foldername(name))[2]
      and b.owner_id = auth.uid()
  )
);

create policy "Owners delete business images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'business-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.businesses b
    where b.id::text = (storage.foldername(name))[2]
      and b.owner_id = auth.uid()
  )
);

commit;
