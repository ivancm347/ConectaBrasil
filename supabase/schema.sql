-- Conecta Brasil: schema inicial
-- Execute este arquivo no SQL Editor do projeto Supabase.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  business_type text not null default 'empresa',
  phone text,
  whatsapp text,
  email text,
  website text,
  instagram text,
  street text,
  neighborhood text,
  city text not null,
  state text not null,
  country text not null default 'Brasil',
  postal_code text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'suspended')),
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_categories (
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  primary key (business_id, category_id)
);

create index if not exists businesses_public_search_idx
  on public.businesses (status, state, city);
create index if not exists businesses_owner_idx
  on public.businesses (owner_id);
create index if not exists business_categories_category_idx
  on public.business_categories (category_id);

insert into public.categories (name, slug, description)
values
  ('Casa e construção', 'casa-construcao', 'Obras, reformas, materiais e serviços de construção.'),
  ('Serviços profissionais', 'servicos-profissionais', 'Profissionais autônomos e especialistas.'),
  ('Lojas e comércio', 'lojas-comercio', 'Lojas, produtos e comércio local.'),
  ('Empresas', 'empresas', 'Empresas e negócios de diferentes segmentos.')
on conflict (slug) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists businesses_set_updated_at on public.businesses;
create trigger businesses_set_updated_at before update on public.businesses
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.businesses enable row level security;
alter table public.business_categories enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles
for select to authenticated using (auth.uid() = id);

drop policy if exists "Users create own profile" on public.profiles;
create policy "Users create own profile" on public.profiles
for insert to authenticated with check (auth.uid() = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Categories are publicly readable" on public.categories;
create policy "Categories are publicly readable" on public.categories
for select to anon, authenticated using (active = true);

drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories" on public.categories
for all to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Approved businesses are public" on public.businesses;
create policy "Approved businesses are public" on public.businesses
for select to anon, authenticated
using (status = 'approved' or owner_id = auth.uid()
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Owners create pending businesses" on public.businesses;
create policy "Owners create pending businesses" on public.businesses
for insert to authenticated
with check (auth.uid() = owner_id and status = 'pending' and featured = false);

drop policy if exists "Owners update own pending businesses" on public.businesses;
create policy "Owners update own pending businesses" on public.businesses
for update to authenticated
using (auth.uid() = owner_id and status = 'pending')
with check (auth.uid() = owner_id and status = 'pending' and featured = false);

drop policy if exists "Admins manage businesses" on public.businesses;
create policy "Admins manage businesses" on public.businesses
for all to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Public read categories links for approved businesses" on public.business_categories;
create policy "Public read categories links for approved businesses" on public.business_categories
for select to anon, authenticated
using (
  exists (
    select 1 from public.businesses b
    where b.id = business_id
      and (b.status = 'approved' or b.owner_id = auth.uid()
        or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  )
);

drop policy if exists "Owners manage categories on own pending businesses" on public.business_categories;
create policy "Owners manage categories on own pending businesses" on public.business_categories
for all to authenticated
using (
  exists (select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid() and b.status = 'pending')
)
with check (
  exists (select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid() and b.status = 'pending')
);

drop policy if exists "Admins manage business category links" on public.business_categories;
create policy "Admins manage business category links" on public.business_categories
for all to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

grant usage on schema public to anon, authenticated;
grant select on public.categories to anon, authenticated;
grant insert, update on public.categories to authenticated;
grant select on public.businesses, public.business_categories to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant insert, update on public.businesses, public.business_categories to authenticated;
