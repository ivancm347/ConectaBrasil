-- Conecta Brasil: controle administrativo de planos e validade dos destaques
-- Execute uma única vez no SQL Editor do Supabase.
-- Migração aditiva: preserva os cadastros e os destaques existentes.

alter table public.businesses
  add column if not exists plan_type text not null default 'gratuito',
  add column if not exists plan_started_at timestamptz,
  add column if not exists plan_expires_at timestamptz,
  add column if not exists featured_expires_at timestamptz;

-- Mantém os destaques antigos sem prazo até que o administrador os revise.
update public.businesses
   set plan_type = 'destaque'
 where featured = true
   and plan_type = 'gratuito';

alter table public.businesses
  drop constraint if exists businesses_plan_type_check;

alter table public.businesses
  add constraint businesses_plan_type_check
  check (plan_type in ('gratuito', 'destaque', 'parceiro'));

comment on column public.businesses.plan_type is
  'Plano comercial vigente: gratuito, destaque ou parceiro.';
comment on column public.businesses.plan_started_at is
  'Data/hora em que o administrador ativou o plano.';
comment on column public.businesses.plan_expires_at is
  'Data/hora de vencimento do plano comercial.';
comment on column public.businesses.featured_expires_at is
  'Data/hora em que o destaque deixa de aparecer automaticamente na vitrine.';
