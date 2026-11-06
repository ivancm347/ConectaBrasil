-- Conecta Brasil: endereço e privacidade da localização dos anúncios
-- Migração aditiva: não remove nem altera os dados existentes.
-- Execute uma única vez no SQL Editor do Supabase.

alter table public.businesses
  add column if not exists postal_code text,
  add column if not exists street text,
  add column if not exists street_number text,
  add column if not exists neighborhood text,
  add column if not exists address_complement text,
  add column if not exists location_visibility text not null default 'neighborhood',
  add column if not exists service_cities text;

-- Cadastros antigos continuam mostrando somente a cidade/região.
update public.businesses
   set location_visibility = 'neighborhood'
 where location_visibility is null
    or location_visibility not in ('exact', 'neighborhood', 'service_area');

alter table public.businesses
  drop constraint if exists businesses_location_visibility_check;

alter table public.businesses
  add constraint businesses_location_visibility_check
  check (location_visibility in ('exact', 'neighborhood', 'service_area'));

comment on column public.businesses.location_visibility is
  'Define se o perfil público exibe endereço comercial completo, somente bairro/cidade ou área de atendimento.';
comment on column public.businesses.service_cities is
  'Cidades ou regiões atendidas, informadas pelo anunciante quando location_visibility = service_area.';
