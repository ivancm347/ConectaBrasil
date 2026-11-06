-- Conecta Brasil: histórico mensal de visualizações e contatos
-- Migração aditiva. Preserva os contadores acumulados e todos os cadastros.
-- Execute uma única vez no SQL Editor do Supabase.

create table if not exists public.business_metric_events (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  metric text not null check (metric in ('views_count', 'whatsapp_clicks')),
  created_at timestamptz not null default now()
);

create index if not exists business_metric_events_month_idx
  on public.business_metric_events (created_at, business_id, metric);

alter table public.business_metric_events enable row level security;

drop policy if exists "Admins read business metric events" on public.business_metric_events;
create policy "Admins read business metric events" on public.business_metric_events
for select to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

grant select on public.business_metric_events to authenticated;

create or replace function public.increment_business_metric(
  p_business_id uuid,
  p_metric text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected_rows integer;
begin
  if p_metric not in ('views_count', 'whatsapp_clicks') then
    raise exception 'Métrica não permitida';
  end if;

  if p_metric = 'views_count' then
    update public.businesses
       set views_count = coalesce(views_count, 0) + 1
     where id = p_business_id
       and status = 'approved';
  else
    update public.businesses
       set whatsapp_clicks = coalesce(whatsapp_clicks, 0) + 1
     where id = p_business_id
       and status = 'approved';
  end if;

  get diagnostics affected_rows = row_count;
  if affected_rows > 0 then
    insert into public.business_metric_events (business_id, metric)
    values (p_business_id, p_metric);
  end if;
end;
$$;

revoke all on function public.increment_business_metric(uuid, text) from public;
grant execute on function public.increment_business_metric(uuid, text) to anon, authenticated;

create or replace function public.get_admin_business_metrics(p_month date)
returns table (
  business_id uuid,
  views_count bigint,
  whatsapp_clicks bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'admin' then
    raise exception 'Acesso restrito à administração'
      using errcode = '42501';
  end if;

  return query
  select
    e.business_id,
    count(*) filter (where e.metric = 'views_count')::bigint,
    count(*) filter (where e.metric = 'whatsapp_clicks')::bigint
  from public.business_metric_events e
  where e.created_at >= p_month::timestamptz
    and e.created_at < (p_month + interval '1 month')::timestamptz
  group by e.business_id;
end;
$$;

revoke all on function public.get_admin_business_metrics(date) from public;
grant execute on function public.get_admin_business_metrics(date) to authenticated;

comment on table public.business_metric_events is
  'Histórico de eventos de visualização de perfil e clique no WhatsApp, para relatórios mensais administrativos.';
