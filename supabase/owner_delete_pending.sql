-- Conecta Brasil: permitir limpeza de cadastros pendentes do próprio usuário.
-- Migração aditiva e idempotente: não remove nem altera registros existentes.
-- Necessária para que o fluxo de cadastro possa desfazer um envio parcial.

drop policy if exists "Owners delete own pending businesses" on public.businesses;

create policy "Owners delete own pending businesses"
on public.businesses
for delete
to authenticated
using (
  auth.uid() = owner_id
  and status = 'pending'
);
