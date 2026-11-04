-- Conecta Brasil: permitir que o dono solicite alterações em anúncios aprovados.
-- Ao salvar uma edição, o anúncio muda para pending e sai da vitrine
-- até a equipe administrativa revisar e aprovar novamente.

drop policy if exists "Owners request edits to approved businesses" on public.businesses;

create policy "Owners request edits to approved businesses"
on public.businesses
for update
to authenticated
using (
  auth.uid() = owner_id
  and status = 'approved'
)
with check (
  auth.uid() = owner_id
  and status = 'pending'
  and featured = false
);

grant update on public.businesses to authenticated;
