-- Conecta Brasil: avaliações moderadas de negócios
-- Migração aditiva. Não altera nem remove anúncios ou dados existentes.
-- Execute uma única vez no SQL Editor do Supabase.

create table if not exists public.business_reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (char_length(btrim(comment)) between 5 and 1000),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  constraint business_reviews_one_per_user unique (business_id, user_id)
);

create index if not exists business_reviews_public_idx
  on public.business_reviews (business_id, status, created_at desc);

create index if not exists business_reviews_user_idx
  on public.business_reviews (user_id, created_at desc);

alter table public.business_reviews enable row level security;

drop policy if exists "Public read approved business reviews" on public.business_reviews;
create policy "Public read approved business reviews"
on public.business_reviews
for select to anon, authenticated
using (
  status = 'approved'
  or user_id = auth.uid()
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
  )
);

drop policy if exists "Admins moderate business reviews" on public.business_reviews;
create policy "Admins moderate business reviews"
on public.business_reviews
for update to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

grant select on public.business_reviews to anon, authenticated;
grant insert on public.business_reviews to authenticated;
grant update (status) on public.business_reviews to authenticated;

comment on table public.business_reviews is
  'Avaliações de negócios enviadas por usuários autenticados. Somente avaliações aprovadas são públicas.';
comment on column public.business_reviews.status is
  'Moderação: pending aguarda análise, approved aparece publicamente, rejected não é exibida.';
