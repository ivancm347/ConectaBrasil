-- Conecta Brasil: imagens de empresas (logo + até 5 fotos)
-- Execute no SQL Editor do Supabase antes de testar os envios.
alter table public.businesses
  add column if not exists logo_url text,
  add column if not exists gallery_urls text[] not null default '{}';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('business-images', 'business-images', true, 5242880,
        array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update
set public = true, file_size_limit = 5242880,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view business images" on storage.objects;
create policy "Public can view business images" on storage.objects
for select to anon, authenticated
using (bucket_id = 'business-images');

drop policy if exists "Owners upload business images" on storage.objects;
create policy "Owners upload business images" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'business-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Owners update business images" on storage.objects;
create policy "Owners update business images" on storage.objects
for update to authenticated
using (
  bucket_id = 'business-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'business-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Owners delete business images" on storage.objects;
create policy "Owners delete business images" on storage.objects
for delete to authenticated
using (
  bucket_id = 'business-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
