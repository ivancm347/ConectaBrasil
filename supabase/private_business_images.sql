-- Conecta Brasil: tornar imagens privadas e liberar leitura somente conforme o anúncio.
-- Execute após publicar o código que gera URLs assinadas.
-- Não remove arquivos nem altera os registros dos negócios.

update storage.buckets
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif']
where id = 'business-images';

drop policy if exists "Public can view business images" on storage.objects;
drop policy if exists "Approved businesses and owners can view business images" on storage.objects;

create policy "Approved businesses and owners can view business images"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'business-images'
  and exists (
    select 1
    from public.businesses b
    where b.id::text = (storage.foldername(name))[2]
      and (
        b.status = 'approved'
        or b.owner_id = auth.uid()
        or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      )
  )
);

-- Mantém upload, atualização e exclusão limitados à pasta do próprio usuário.
