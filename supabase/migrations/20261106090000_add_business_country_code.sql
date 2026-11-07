-- CONECTA: primeira etapa de preparação internacional.
-- Migração aditiva: preserva registros e a coluna legada "country".
-- Preparada para BR/PY; não altera anúncios existentes sem país reconhecido.
-- NÃO aplicar em produção antes da revisão completa de RLS, Storage e contexto de país.

begin;

alter table public.businesses
  add column if not exists country_code text;

-- Valida os valores legados antes de converter.
-- País nulo, vazio ou desconhecido interrompe a migração em vez de assumir Brasil.
do $$
begin
  if exists (
    select 1
    from public.businesses
    where country_code is null
      and lower(trim(coalesce(country, ''))) not in (
        'brasil', 'brazil', 'br',
        'paraguai', 'paraguay', 'py'
      )
  ) then
    raise exception
      'Migração cancelada: existem anúncios com country nulo, vazio ou não reconhecido. Revise public.businesses.country antes de continuar.';
  end if;
end $$;

-- Converte somente valores explicitamente reconhecidos.
update public.businesses
set country_code = case
  when lower(trim(country)) in ('paraguai', 'paraguay', 'py') then 'PY'
  when lower(trim(country)) in ('brasil', 'brazil', 'br') then 'BR'
end
where country_code is null;

-- Segunda validação: impede NOT NULL se algum registro ficou sem classificação.
do $$
begin
  if exists (
    select 1
    from public.businesses
    where country_code is null
  ) then
    raise exception
      'Migração cancelada: pelo menos um anúncio ficou sem country_code.';
  end if;
end $$;

alter table public.businesses
  alter column country_code set default 'BR';

alter table public.businesses
  alter column country_code set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.businesses'::regclass
      and conname = 'businesses_country_code_check'
  ) then
    alter table public.businesses
      add constraint businesses_country_code_check
      check (country_code in ('BR', 'PY'));
  end if;
end $$;

create index if not exists businesses_country_status_city_idx
  on public.businesses (country_code, status, city);

comment on column public.businesses.country_code is
  'País operacional do anúncio: BR (Brasil) ou PY (Paraguai). Campo preparado para expansão internacional do CONECTA.';

commit;
