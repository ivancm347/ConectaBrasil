-- Conecta Brasil: proteger campos administrativos dos anúncios.
-- Migração aditiva: não altera nem remove cadastros existentes.
-- Proprietários podem editar os dados comerciais permitidos, mas não podem
-- conceder planos, destacar, verificar ou alterar métricas/identidade do anúncio.
-- Administradores continuam podendo gerenciar todos os campos.

create or replace function public.protect_business_owner_fields()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  -- A administração usa app_metadata.role, validado também pelas políticas RLS.
  if (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' then
    return new;
  end if;

  -- Operações de backend sem usuário autenticado não são restringidas por esta
  -- proteção de proprietário; devem continuar protegidas pela credencial do servidor.
  if auth.uid() is null then
    return new;
  end if;

  if auth.uid() = old.owner_id then
    if new.owner_id is distinct from old.owner_id
      or new.slug is distinct from old.slug
      or (new.featured is distinct from old.featured
        and not (old.status = 'approved' and new.status = 'pending' and new.featured = false))
      or new.plan_type is distinct from old.plan_type
      or new.plan_started_at is distinct from old.plan_started_at
      or new.plan_expires_at is distinct from old.plan_expires_at
      or new.featured_expires_at is distinct from old.featured_expires_at
      or new.verified is distinct from old.verified
      or new.views_count is distinct from old.views_count
      or new.whatsapp_clicks is distinct from old.whatsapp_clicks
      or new.created_at is distinct from old.created_at then
      raise exception 'Proprietários não podem alterar campos administrativos do anúncio.'
        using errcode = '42501';
    end if;

    -- O proprietário pode solicitar nova análise de anúncio aprovado,
    -- mas não pode aprovar, rejeitar ou suspender o próprio cadastro.
    if old.status = 'approved' and new.status <> 'pending'
      or old.status <> 'approved' and new.status is distinct from old.status then
      raise exception 'A situação do anúncio só pode ser alterada pela administração.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists businesses_protect_owner_fields on public.businesses;
create trigger businesses_protect_owner_fields
before update on public.businesses
for each row execute function public.protect_business_owner_fields();
