-- Conecta Brasil: histórico de ações administrativas
-- Execute este arquivo no SQL Editor do Supabase.
-- Somente usuários autenticados com app_metadata.role = 'admin'
-- podem consultar ou inserir registros. Não há permissão de update/delete.

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid default auth.uid() references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  entity_name text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_at_idx
  on public.admin_audit_logs (created_at desc);

alter table public.admin_audit_logs enable row level security;

drop policy if exists "Admins read audit logs" on public.admin_audit_logs;
create policy "Admins read audit logs" on public.admin_audit_logs
for select to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins insert audit logs" on public.admin_audit_logs;
create policy "Admins insert audit logs" on public.admin_audit_logs
for insert to authenticated
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and actor_id = auth.uid()
);

grant select, insert on public.admin_audit_logs to authenticated;
