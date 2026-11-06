-- Secure ownership checks for private business images.
-- Approved listings remain publicly readable, but only through a path
-- whose first folder matches the actual business owner and whose second
-- folder matches the business ID.
begin;

create or replace function public.can_view_business_image(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.businesses as b
    where b.id::text = (storage.foldername(object_name))[2]
      and b.owner_id::text = (storage.foldername(object_name))[1]
      and (
        b.status = 'approved'
        or b.owner_id = auth.uid()
        or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
      )
  );
$function$;

revoke all on function public.can_view_business_image(text) from public;
grant execute on function public.can_view_business_image(text) to anon, authenticated;

drop policy if exists "Approved businesses and owners can view business images"
  on storage.objects;
create policy "Approved businesses and owners can view business images"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'business-images'
  and public.can_view_business_image(name)
);

drop policy if exists "Owners upload business images" on storage.objects;
create policy "Owners upload business images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'business-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.businesses as b
    where b.id::text = (storage.foldername(name))[2]
      and b.owner_id = auth.uid()
      and b.country_code = (auth.jwt() -> 'app_metadata' ->> 'market_code')
  )
);

drop policy if exists "Owners update business images" on storage.objects;
create policy "Owners update business images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'business-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.businesses as b
    where b.id::text = (storage.foldername(name))[2]
      and b.owner_id = auth.uid()
      and b.country_code = (auth.jwt() -> 'app_metadata' ->> 'market_code')
  )
)
with check (
  bucket_id = 'business-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.businesses as b
    where b.id::text = (storage.foldername(name))[2]
      and b.owner_id = auth.uid()
      and b.country_code = (auth.jwt() -> 'app_metadata' ->> 'market_code')
  )
);

drop policy if exists "Owners delete business images" on storage.objects;
create policy "Owners delete business images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'business-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.businesses as b
    where b.id::text = (storage.foldername(name))[2]
      and b.owner_id = auth.uid()
      and b.country_code = (auth.jwt() -> 'app_metadata' ->> 'market_code')
  )
);

commit;
