-- Scope private business reviews to the trusted market in the session.
-- Approved reviews remain publicly readable across markets.
begin;

drop policy if exists "Public read approved business reviews" on public.business_reviews;
create policy "Public read approved business reviews"
on public.business_reviews
for select to anon, authenticated
using (
  status = 'approved'
  or (
    user_id = auth.uid()
    and exists (
      select 1
      from public.businesses b
      where b.id = business_id
        and b.country_code = (auth.jwt() -> 'app_metadata' ->> 'market_code')
    )
  )
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

drop policy if exists "Authenticated users submit pending business reviews" on public.business_reviews;
create policy "Authenticated users submit pending business reviews"
on public.business_reviews
for insert to authenticated
with check (
  user_id = auth.uid()
  and status = 'pending'
  and exists (
    select 1
    from public.businesses b
    where b.id = business_id
      and b.status = 'approved'
      and b.country_code = (auth.jwt() -> 'app_metadata' ->> 'market_code')
  )
);

commit;
