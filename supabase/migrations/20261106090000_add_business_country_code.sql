-- CONECTA: primeira etapa de preparação internacional.
-- Migração aditiva: preserva registros e a coluna legada "country".
-- Executar primeiro em ambiente de teste; NÃO aplicar em produção sem revisão.

begin;

alter table public.businesses
  add column if not exists country_code text;

-- Compatibilidade: converte os nomes de país já armazenados.
-- Registros sem país reconhecível permanecem no Brasil, que é o mercado atual.
update public.businesses
set country_code = case
  when lower(trim(coalesce(country, ''))) in ('paraguai', 'paraguay', 'py') then 'PY'
  when lower(trim(coalesce(country, ''))) in ('brasil', 'brazil', 'br', '') then 'BR'
  else 'BR'
end
where country_code is null;

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
