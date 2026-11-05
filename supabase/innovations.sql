-- Conecta Brasil: métricas e selo de verificação
-- Execute uma única vez no SQL Editor do Supabase.
-- Não altera nem remove cadastros existentes.

alter table public.businesses
  add column if not exists verified boolean not null default false,
  add column if not exists views_count bigint not null default 0,
  add column if not exists whatsapp_clicks bigint not null default 0;

create or replace function public.increment_business_metric(
  p_business_id uuid,
  p_metric text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_metric = 'views_count' then
    update public.businesses
       set views_count = views_count + 1
     where id = p_business_id
       and status = 'approved';
  elsif p_metric = 'whatsapp_clicks' then
    update public.businesses
       set whatsapp_clicks = whatsapp_clicks + 1
     where id = p_business_id
       and status = 'approved';
  else
    raise exception 'Métrica não permitida';
  end if;
end;
$$;

revoke all on function public.increment_business_metric(uuid, text) from public;
grant execute on function public.increment_business_metric(uuid, text) to anon, authenticated;

comment on column public.businesses.verified is
  'Selo de verificação concedido exclusivamente pela equipe administradora.';
comment on column public.businesses.views_count is
  'Contagem aproximada de aberturas do perfil público.';
comment on column public.businesses.whatsapp_clicks is
  'Contagem aproximada de cliques para contato pelo WhatsApp.';
