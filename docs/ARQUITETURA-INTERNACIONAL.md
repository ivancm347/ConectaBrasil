# Arquitetura internacional do CONECTA

## 1. Objetivo

Preparar o CONECTA para operar em mais de um país, começando por:

- **Brasil:** ConectaBrasil — português (pt-BR), real (BRL).
- **Paraguai:** Conecta Paraguay — espanhol (es), guarani (PYG).

A plataforma e a administração podem ser compartilhadas, mas empresas, categorias, avaliações, métricas e demais dados de cada mercado devem permanecer isolados.

> **Situação desta branch:** implementação técnica de isolamento em andamento e em validação. O mercado PY ainda não está liberado para operação pública.

## 2. Princípios obrigatórios

1. Não apagar, recriar ou migrar destrutivamente cadastros existentes.
2. Preservar os registros brasileiros como mercado BR.
3. Não misturar empresas, categorias, avaliações, imagens, métricas ou relatórios entre países.
4. Aplicar o isolamento no banco (RLS e funções seguras), não apenas no frontend.
5. Não alterar preços, planos, pagamentos ou regras comerciais brasileiras nesta etapa.
6. Não habilitar pagamentos paraguaios antes de definir um meio de recebimento compatível.
7. Não publicar na `main`, fazer merge, deploy ou habilitar o mercado PY sem validação e autorização explícita.
8. Não usar dados reais de clientes para testes de isolamento; utilizar dados fictícios em ambiente controlado.

## 3. Modelo de mercado

Usar códigos estáveis em vez de depender de nomes livres:

| Campo | Brasil | Paraguai |
|---|---|---|
| Código | BR | PY |
| Nome | Brasil | Paraguay |
| Idioma | pt-BR | es |
| Moeda | BRL | PYG |
| Símbolo | R$ | Gs. |
| Marca pública | ConectaBrasil | Conecta Paraguay |

O contexto de mercado selecionado é enviado ao banco pelo header `x-market-code`. Quando aplicável, o banco também utiliza a claim confiável `market_code` do JWT como contexto/fallback. O frontend não deve ser considerado uma fronteira de segurança.

## 4. Implementação já realizada

### 4.1 Banco e categorias

- A tabela `public.categories` possui `country_code`, com padrão `BR` e restrição aos códigos `BR` e `PY`.
- As restrições de unicidade de nome e slug são compostas por país: `(country_code, name)` e `(country_code, slug)`.
- A leitura pública de categorias ativas é filtrada pelo mercado selecionado no header ou pela claim de mercado do JWT.
- Os seis registros de categorias existentes permanecem no mercado BR.
- A tabela `business_categories` tem políticas para administração global, leitura do proprietário no mercado atribuído e leitura pública das categorias de empresas aprovadas no mesmo mercado.
- As políticas verificam a correspondência entre o país da categoria e o país da empresa.

### 4.2 Empresas e demais dados

- A tabela `businesses` tem políticas RLS para leitura pública de empresas aprovadas no mercado selecionado.
- As operações dos proprietários são limitadas às próprias empresas e ao mercado atribuído, com regras específicas para criação, leitura, edição e exclusão de cadastros pendentes.
- A edição de uma empresa pelo proprietário exige que o registro permaneça pendente conforme a política atual; revisar o fluxo de edição/aprovação antes de alterar essa regra.
- `business_reviews` aplica regras de mercado à submissão e leitura pública de avaliações aprovadas.
- `profiles` limita leitura e alteração ao próprio usuário.
- `admin_audit_logs` permite leitura e inserção somente conforme as regras administrativas.
- `business_metric_events` não concede escrita direta a usuários comuns; a contabilização passa pela função controlada.

### 4.3 Autenticação e funções seguras

- O Custom Access Token Hook `custom_access_token_hook` está habilitado e utiliza `app_metadata.market_code` como fonte confiável para emitir a claim `market_code`, aceitando BR/PY.
- A função `can_view_business_image(object_name)` valida o acesso à imagem considerando empresa, proprietário, aprovação, administração e mercado.
- As funções administrativas de métricas verificam a permissão de administrador.
- `increment_business_metric` aceita somente as métricas previstas e contabiliza eventos de empresas aprovadas no mercado selecionado.
- A função de manutenção automática de RLS `rls_auto_enable()` está restrita a papéis de serviço/administrador do banco; não é executável por `anon` ou `authenticated`.

### 4.4 Privilégios e Storage

- Privilégios diretos desnecessários foram revogados de `anon` e `authenticated`, incluindo operações de escrita em tabelas de auditoria e eventos de métricas.
- O bucket `business-images` é privado e possui políticas de leitura/escrita que utilizam a função de autorização e a relação entre proprietário, caminho e mercado.
- **Ponto pendente de revisão:** reforçar explicitamente as condições de mercado permitido nas políticas de escrita do Storage e validar o comportamento em testes com usuários e arquivos fictícios de BR e PY.

## 5. Validações já executadas

- RLS está habilitado nas tabelas de aplicação auditadas: `admin_audit_logs`, `business_categories`, `business_metric_events`, `business_reviews`, `businesses`, `categories` e `profiles`.
- Foram revisadas as políticas RLS, os privilégios SQL e as funções `SECURITY DEFINER`.
- A função do Custom Access Token Hook foi verificada para os códigos BR/PY e para código inválido.
- Consultas de consistência entre país da empresa e país da categoria não apontaram divergências.
- Testes com contexto BR retornaram as seis categorias brasileiras; com contexto PY não retornaram categorias, pois ainda não há catálogo PY.
- A branch `feature/arquitetura-internacional` teve o teste automatizado corrigido após remover uma declaração duplicada de variável em `tests/security-contract.test.js`. A execução seguinte do GitHub Actions foi reportada como concluída com testes e build aprovados.

### Limitação importante dos testes atuais

As tabelas de empresas, perfis, associações de categorias, avaliações e eventos de métricas estavam sem registros no momento da auditoria. Portanto, resultados vazios nas consultas BR/PY **não comprovam, por si só, o isolamento real de anúncios entre países**. Ainda é necessário testar com registros fictícios distintos em cada mercado e usuários de teste com claims apropriadas.

## 6. Pendências antes de habilitar o Paraguai

1. Criar uma massa de dados exclusivamente fictícia para BR e PY em ambiente controlado.
2. Testar leitura, criação, edição e exclusão por usuários de cada mercado, incluindo tentativas de acesso cruzado.
3. Validar avaliações, métricas, imagens e políticas de Storage com arquivos e usuários de teste.
4. Revisar explicitamente as políticas de escrita do Storage para aceitar somente mercados válidos.
5. Revisar cache local, busca, formulários, campos de localização, idioma, moeda e categorias no frontend.
6. Revisar o painel administrativo para filtros, indicadores e relatórios por país.
7. Confirmar que o mercado brasileiro não sofreu regressões.
8. Definir operação comercial, suporte, termos, pagamentos e recebimento no Paraguai.
9. Atualizar esta documentação com os resultados dos testes antes de propor a ativação.

## 7. Sequência de trabalho

### Etapa A — Isolamento no banco
**Implementada parcialmente; requer testes de integração com dados fictícios.**

Inclui códigos de país, categorias separadas, políticas RLS, revisão de privilégios, funções seguras e contexto de mercado.

### Etapa B — Testes de segurança
**Em andamento.**

Executar testes positivos e negativos para BR/PY, inclusive acesso cruzado, Storage, avaliações e métricas. Não considerar consultas vazias como prova suficiente.

### Etapa C — Aplicativo e experiência internacional
**Pendente de validação.**

Centralizar configuração BR/PY, seletor de mercado, idioma, moeda, localização, categorias e cache segregado.

### Etapa D — Administração e operação
**Pendente.**

Adicionar visão administrativa por país e definir regras operacionais e comerciais específicas.

### Etapa E — Liberação controlada
**Bloqueada até aprovação das etapas anteriores.**

Somente após testes documentados, revisão das pendências e autorização explícita será avaliada a habilitação do PY e eventual publicação.

## 8. Critérios de aceite

- Um usuário BR não consegue consultar nem modificar dados privados do mercado PY, e vice-versa.
- Empresas, categorias, avaliações, imagens, métricas, buscas e cache respeitam o mercado.
- O painel administrativo identifica claramente o país e respeita os papéis autorizados.
- O mercado BR continua funcionando sem regressões.
- Testes positivos e negativos são executados com dados fictícios e resultados registrados.
- Nenhuma mudança é publicada em produção ou habilita o mercado PY antes de revisão e aprovação explícitas.
