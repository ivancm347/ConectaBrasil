# Plano de testes de segurança — ConectaBrasil

Escopo: branch `feature/arquitetura-internacional`, mercados BR/PY, RLS e bucket privado `business-images`.

## Estado da branch em 13/11/2026

- `package.json` possui `npm test` (`node --test`).
- `.github/workflows/security-tests.yml` executa testes e build em pushes nesta branch e em pull requests direcionados a `main`.
- `tests/security-contract.test.js` verifica contratos textuais das migrações, policies, funções e trechos da aplicação.
- Última execução verificada: GitHub Actions run [#162](https://github.com/ivancm347/ConectaBrasil/actions/runs/43472109261), concluída com sucesso em 13/11/2026: 31 testes registrados, 27 aprovados, 4 marcados como `TODO`, 0 falhas; `npm run build` também concluiu.
- **Limitação importante:** os testes aprovados são verificações estáticas de arquivos. Não executam PostgreSQL RLS nem operações reais no Supabase Storage. Os quatro casos de integração continuam pendentes; portanto, o sucesso do CI não comprova isolamento real no banco.

## Distinção entre vitrine pública e autorização

Anúncios aprovados foram definidos como conteúdo público. O cabeçalho `x-market-code` seleciona a vitrine consultada (BR ou PY), mas é fornecido pelo cliente e não é uma credencial nem uma barreira de confidencialidade. Um visitante pode escolher outra vitrine ou enviar outro cabeçalho e consultar anúncios aprovados daquele mercado.

Assim:
- Testar que uma requisição de vitrine com `x-market-code: BR` retorna anúncios aprovados BR e que `PY` retorna anúncios aprovados PY.
- Não afirmar que anúncios aprovados de PY são inacessíveis a um visitante que esteja na vitrine BR.
- Usar claim assinada e confiável de `app_metadata.market_code` para operações privadas de proprietário.
- Se a regra de produto mudar para tornar anúncios aprovados inacessíveis entre mercados, será necessária uma arquitetura pública server-side; filtro React, rota ou cabeçalho arbitrário não bastam.

## Regras que os testes devem provar

### RLS de anúncios

1. Visitante anônimo consulta anúncios aprovados da vitrine selecionada pelo cabeçalho BR/PY.
2. Anúncios pendentes/rejeitados não aparecem na consulta pública.
3. Proprietário autenticado consulta seus próprios anúncios pendentes.
4. Proprietário A não lê, altera nem exclui anúncios privados do proprietário B.
5. Proprietário BR não cria nem altera anúncios PY; proprietário PY não cria nem altera anúncios BR.
6. Trocar rota, localStorage, cabeçalho ou `user_metadata` não muda a autorização de operações de proprietário.
7. Ausência de claim confiável ou claim inválida não concede operações privadas.
8. Administrador global autorizado administra os dois mercados e mantém auditoria.

### Storage — bucket `business-images`

1. O bucket permanece privado.
2. Upload exige UID autenticado na primeira pasta e anúncio existente, na segunda pasta, pertencente ao mesmo usuário.
3. Upload para anúncio de outro proprietário, ID inexistente ou UID de pasta divergente é recusado.
4. Update exige as mesmas condições em `USING` e `WITH CHECK`, inclusive ao tentar mover o objeto.
5. Delete exige propriedade do anúncio associado.
6. O caminho do objeto deve corresponder ao proprietário real do anúncio também na leitura.
7. Imagens de anúncios aprovados são públicas conforme a regra de produto; isso não deve ser descrito como isolamento confidencial entre países. Imagens de anúncios pendentes ficam restritas ao proprietário autorizado e à administração.
8. URLs assinadas devem ser geradas somente após autorização; não tornar o bucket público como atalho.

### Avaliações e métricas

1. Inserção de avaliação exige usuário autenticado e anúncio aprovado no mercado confiável da sessão.
2. Usuário não altera nem modera avaliação de terceiros.
3. Eventos de métricas não podem ser lidos por usuários comuns.
4. RPC pública de incremento aceita somente métricas permitidas e anúncios aprovados.
5. RPC de relatório administrativo exige administrador e permite filtrar BR/PY.

## Migrações sob revisão

### `20261106120000_secure_business_image_ownership.sql`

É a primeira camada de proteção de INSERT/UPDATE/DELETE no Storage: valida UID da pasta e vínculo entre `business_id` e `businesses.owner_id`. Não implementa isolamento por mercado; é sucedida pela migração `20261106150000_secure_business_image_storage_policies.sql`, que acrescenta o contexto confiável e a função de leitura. O teste de contrato agora referencia diretamente este arquivo para evitar que ele fique fora da suíte.

### `20261106150000_secure_business_image_storage_policies.sql`

Substitui as policies de Storage e define `can_view_business_image` como `SECURITY DEFINER` com `search_path` vazio. A função valida que o ID do anúncio e a pasta do proprietário correspondem ao registro real. Operações privadas do proprietário exigem `app_metadata.market_code`; a leitura de imagens aprovadas continua pública conforme a regra de produto.

### `20261107110000_scope_public_business_listing_by_market_header.sql`

Substitui a policy pública antiga por uma policy que filtra a vitrine com `x-market-code`. É essencial remover também a policy legada `Approved businesses are public`: policies RLS permissivas se combinam por `OR`, então manter a policy antiga anularia o filtro novo. A migração e a suíte estática agora verificam essa remoção.

## Pré-requisitos para testes de integração

- Projeto Supabase de desenvolvimento separado, sem dados de produção; ainda não há evidência de que um ambiente assim esteja configurado.
- Dois proprietários distintos (um BR e um PY), um administrador de teste e anúncios aprovados/pendentes nos dois mercados.
- JWTs obtidos por autenticação normal, sem guardar tokens ou segredos no repositório.
- Executar as operações com clientes anon/authenticated reais. Não usar `service_role` para simular usuários, pois pode contornar RLS.
- Asserções negativas e positivas para SELECT/INSERT/UPDATE/DELETE, upload, update, download/URL assinada e delete.
- Testar a emissão e renovação da claim de mercado; a ausência dela deve negar operações privadas.

## Critério para liberar Paraguay

Manter `MARKETS.PY.enabled = false` até que:
- o contexto confiável de mercado esteja validado;
- as policies RLS antigas e novas estejam reconciliadas;
- os testes de integração RLS e Storage passem em ambiente de desenvolvimento;
- a vitrine BR e a compatibilidade de imagens existentes sejam verificadas;
- avaliações, métricas, build e suíte automatizada estejam aprovados.

## Segurança operacional

Este plano não autoriza alterações em produção. Não aplicar migrações, alterar dados/permissões, fazer merge ou deploy durante as revisões. O CI verde de testes estáticos não substitui a validação real no Supabase.
