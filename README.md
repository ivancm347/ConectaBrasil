# Conecta Brasil 🇧🇷

**Conexões que movimentam.**

O Conecta Brasil conecta pessoas, empresas, profissionais, lojas e serviços. A plataforma começa pela Baixada Santista e está preparada para crescer em todo o país.

## Recursos

### Para visitantes
- Vitrine pública de negócios aprovados, sem exigir login.
- Busca por nome, serviço, descrição e cidade, com tratamento de acentos e termos relacionados.
- Filtros por categoria e cidade, paginação e favoritos salvos no próprio navegador.
- Busca por voz em português nos navegadores compatíveis.
- Localização opcional do visitante, somente após autorização, com abertura do OpenStreetMap.
- Perfil público com logo, galeria de fotos, WhatsApp, compartilhamento por link e QR Code.
- Solicitação de orçamento pelo WhatsApp.
- Exibição de negócios em destaque e selo de verificação.

### Para anunciantes
- Cadastro e login por e-mail e senha, com sessão persistente.
- Envio de negócio para análise administrativa.
- Painel para acompanhar situação, editar dados e compartilhar o próprio anúncio.
- Edições de anúncios aprovados retornam para análise antes de reaparecer na vitrine.
- Cadastro de logo e até cinco fotos.
- Métricas aproximadas de visualizações do perfil e cliques no WhatsApp.

### Para administração
- Aprovar, rejeitar, suspender, editar e excluir cadastros.
- Gerenciar categorias, destaques, selo de verificação e planos.
- Planos Gratuito, Destaque e Parceiro, com controle de validade e renovação por 30 dias.
- Indicadores de cadastros, planos ativos, vencidos e próximos do vencimento.
- Histórico de ações administrativas.
- Resumo financeiro estimado e relatório mensal com impressão/salvamento em PDF e exportação CSV.
- Alertas para cadastros pendentes e planos que precisam de atenção.

## Planos comerciais

- **Gratuito — R$ 0:** presença na vitrine, perfil público, WhatsApp, compartilhamento e QR Code.
- **Destaque — R$ 29,90 por 30 dias:** recursos gratuitos e anúncio destacado.
- **Parceiro — R$ 49,90 por 30 dias:** recursos gratuitos, destaque e apoio na criação de texto promocional.

Os valores são referências comerciais configuráveis. O aplicativo não processa pagamentos nem confirma contratações. O administrador só deve ativar ou renovar um plano após confirmar o pagamento por um canal externo. Os relatórios refletem ações administrativas registradas, não movimentações bancárias.

## Tecnologias

- React 18 e Vite
- Supabase Auth, PostgreSQL, Storage e Row Level Security (RLS)
- Lucide React e QRCode
- GitHub Actions e GitHub Pages
- Aplicação web progressiva (PWA), com recursos de instalação e suporte a uso com conexão instável

## Configuração e publicação

1. Crie um projeto no Supabase.
2. Execute `supabase/schema.sql` no SQL Editor.
3. Execute as migrações adicionais necessárias para os recursos habilitados, conforme a seção abaixo.
4. No GitHub, abra **Settings → Secrets and variables → Actions**.
5. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com os dados do projeto Supabase. Use somente a chave pública/anon (publishable) no frontend. Nunca coloque a chave `service_role` ou uma secret key em variáveis `VITE_*`.
6. Em **Settings → Pages → Build and deployment**, selecione **GitHub Actions**.
7. A cada envio para a branch principal, o workflow executa o build e publica a aplicação.

## Migrações do Supabase

Execute cada arquivo uma vez no **SQL Editor** do projeto Supabase, caso o recurso correspondente ainda não esteja configurado. As migrações do banco não são executadas pelo GitHub Actions.

| Arquivo | Finalidade |
| --- | --- |
| `supabase/business_images.sql` | Colunas de logo/galeria e bucket público de imagens, com políticas de acesso por proprietário. |
| `supabase/innovations.sql` | Selo de verificação, contadores aproximados e função controlada para registrar métricas. |
| `supabase/business_metrics_monthly.sql` | Histórico mensal de visualizações e cliques no WhatsApp, mantendo os totais acumulados existentes. |
| `supabase/admin_audit.sql` | Histórico de ações administrativas. |
| `supabase/plans.sql` | Tipo de plano e datas de início/vencimento. Preserva cadastros e destaques existentes. |
| `supabase/owner_edit_approved.sql` | Permite ao proprietário solicitar edição de anúncio aprovado; a edição volta para análise. |
| `supabase/owner_delete_pending.sql` | Permite ao proprietário excluir somente o próprio cadastro com status `pending`, necessário para desfazer envios incompletos. |
| `supabase/protect_business_owner_fields.sql` | Impede proprietários de alterar plano, destaque, selo, métricas, identidade e situação administrativa do próprio anúncio. |

Essas migrações são aditivas ou recriam somente as políticas nomeadas nelas. Não apague tabelas nem registros para aplicar atualizações. Se uma migração já foi executada, não é necessário repeti-la, exceto quando uma atualização específica indicar o contrário.

## Habilitar a conta administradora

A conta precisa existir primeiro em **Authentication → Users**. Depois, no SQL Editor, substitua o e-mail de exemplo pelo e-mail da conta e execute:

```sql
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'SEU_EMAIL_DE_LOGIN';
```

O painel verifica `app_metadata.role` e as políticas RLS também validam essa função. Não use `user_metadata` para conceder privilégios. Depois de alterar a função, saia da conta e entre novamente para renovar a sessão.

## Rodar localmente

```bash
npm install
npm run dev
```

## Gerar versão de produção

```bash
npm run build
npm run preview
```

## Segurança e privacidade

- Visitantes anônimos consultam somente negócios aprovados.
- Proprietários autenticados acompanham e alteram somente os próprios cadastros, respeitando o fluxo de análise.
- A exclusão pelo proprietário é restrita a cadastros próprios ainda pendentes.
- Aprovação, moderação, planos e categorias são protegidos por políticas RLS e função administrativa.
- Imagens são armazenadas em bucket próprio; o acesso de escrita é limitado à pasta do usuário autenticado.
- A localização do visitante só é solicitada após ação explícita; as coordenadas não são armazenadas pelo Conecta Brasil.
- Nunca exponha a chave `service_role` no navegador ou em variáveis `VITE_*`.

---

Conecta Brasil — um país inteiro de possibilidades.
