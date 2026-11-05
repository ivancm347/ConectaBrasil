-- RECUPERAÇÃO TEMPORÁRIA: restaurar exibição das imagens da vitrine.
-- Execute somente depois que o deploy deste ajuste terminar com sucesso.
-- Não apaga arquivos nem altera registros dos negócios.
update storage.buckets
set public = true
where id = 'business-images';

drop policy if exists "Approved businesses and owners can view business images" on storage.objects;
drop policy if exists "Public can view business images" on storage.objects;

create policy "Public can view business images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'business-images');
