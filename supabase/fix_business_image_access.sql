-- Corrige a autorização de leitura das imagens sem tornar o bucket público.
-- A função verifica somente se o arquivo pertence a um anúncio aprovado,
-- ao próprio proprietário ou a um administrador. Não altera nem apaga imagens.

create or replace function public.can_view_business_image(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage, pg_temp
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id::text = (storage.foldername(object_name))[2]
      and (
        b.status = 'approved'
        or b.owner_id = auth.uid()
        or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
      )
  );
$$;

revoke all on function public.can_view_business_image(text) from public;
grant execute on function public.can_view_business_image(text) to anon, authenticated;

drop policy if exists "Approved businesses and owners can view business images" on storage.objects;
drop policy if exists "Public can view business images" on storage.objects;

create policy "Approved businesses and owners can view business images"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'business-images'
  and public.can_view_business_image(name)
);
