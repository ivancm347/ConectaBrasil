# Inventário técnico para isolamento por país

Branch: `feature/arquitetura-internacional`  
Status: levantamento de código e scripts; nenhuma alteração aplicada ao Supabase.

## 1. Estruturas confirmadas no repositório

| Estrutura | Evidência | Estratégia proposta |
|---|---|---|
| `businesses` | `supabase/schema.sql` | Possui `country` legado; adicionar e usar `country_code` como BR/PY. |
| `categories` | `supabase/schema.sql` | Catálogo comum inicialmente; nomes/descrições precisarão de tradução ou tabela de traduções. |
| `business_categories` | `supabase/schema.sql` | Relação pertence ao anúncio; país pode ser obtido por `business_id`. |
| `business_reviews` | `supabase/business_reviews.sql` | País pode ser derivado do negócio relacionado; políticas atuais de leitura não filtram país. |
| `business_metric_events` | `supabase/business_metrics_monthly.sql` | País pode ser derivado por `business_id`; RPC administrativa deve respeitar país selecionado/permissão. |
| `admin_audit_logs` | `supabase/admin_audit.sql` | Não tem país; avaliar adicionar país/escopo quando houver administração dividida. |
| `storage.objects` / bucket `business-images` | `supabase/business_images.sql` | Arquivos usam pastas de usuário e negócio; manter vínculo com negócio e revisar política para escopo por país. |
| Planos | `supabase/plans.sql` | Os campos comerciais estão na própria tabela `businesses`; não alterar preços ou validade nesta fase. |
| Endereço | `supabase/business_location.sql` | Campos ficam em `businesses`; revisar CEP/código postal e endereço conforme país. |

## 2. Comportamento atual confirmado no frontend

Arquivo: `src/main.jsx`.

- `fetchPublicBusinesses()` consulta anúncios aprovados sem filtro de `country_code`.
- O cache público usa a chave única `conecta-public-businesses`, sem país.
- O horário de sincronização usa `conecta-last-sync`, também sem país.
- Favoritos usam `conecta-favorites`; precisam ser avaliados para evitar mistura entre as duas vitrines.
- Avaliações são consultadas por `business_id`, o que permite herdar o país pelo anúncio.
- Upload e leitura das imagens usam o bucket `business-images`.

## 3. Pontos de segurança antes de habilitar PY

1. Não basta filtrar a tela: revisar as políticas RLS e as RPCs para que operações administrativas e relatórios não misturem países.
2. Para avaliações e métricas, usar relação com `businesses` em vez de duplicar país sem necessidade.
3. Para imagens, validar o negócio relacionado ao caminho do arquivo e sua autorização.
4. Separar chaves de cache por país (ex.: `conecta-public-businesses:BR` e `conecta-public-businesses:PY`).
5. Definir como a seleção de país chega ao banco. Uma condição RLS não consegue inferir com segurança a aba visual escolhida pelo usuário; a arquitetura deve definir um contexto confiável ou uma consulta/RPC controlada.
6. Definir o escopo de administradores: global, Brasil ou Paraguai. Não presumir que todos os administradores podem gerir ambos.
7. Não habilitar cadastro PY nem alterar pagamentos, planos, anúncios ou produção nesta etapa.

## 4. Limites deste levantamento

O arquivo `supabase/schema.sql` é o schema inicial e não representa sozinho todas as alterações que podem ter sido executadas manualmente no projeto Supabase. Os scripts auxiliares do repositório foram inspecionados, mas não temos aqui uma exportação atual do banco em produção, das políticas efetivamente instaladas, dos buckets nem dos dados existentes.

Antes de desenhar uma migração de RLS, comparar este inventário com o schema e as policies reais do projeto Supabase. Não executar SQL de alteração em produção com base apenas neste documento.

## 5. Próxima etapa segura

Obter uma exportação somente leitura do schema/policies atuais do Supabase (sem chaves ou dados pessoais), comparar com os scripts versionados e então preparar uma migração revisável que:
- preserve todos os anúncios brasileiros como BR;
- associe avaliações e métricas ao país do negócio;
- mantenha o catálogo de categorias comum inicialmente;
- limite administração e relatórios ao escopo autorizado;
- deixe a vitrine PY desativada até os testes de isolamento passarem.
