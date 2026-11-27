# Plano de testes de segurança — ConectaBrasil

Escopo: branch `feature/arquitetura-internacional`, mercados BR/PY, RLS e bucket privado `business-images`.

## Estado da branch em 20/11/2026

- `package.json` possui `npm test` (`node --test`).
- `.github/workflows/security-tests.yml` executa testes e build em pushes nesta branch e em pull requests direcionados a `main`.
- `tests/security-contract.test.js` verifica contratos textuais das migrações, policies, funções e trechos da aplicação.
- Última execução verificada: GitHub Actions run [#44782781249](https://github.com/ivancm347/ConectaBrasil/actions/runs/44782781249), concluída com sucesso em 20/11/2026: 39 testes registrados, 35 aprovados, 4 marcados como `TODO`, 0 falhas; `npm run build` também concluiu.
- A migração `20261106150000_secure_business_image_storage_policies.sql` agora reforça `business-images` como bucket privado e remove a policy legada `Public can view business images`, que poderia contornar as novas verificações de leitura.
- **Limitação importante:** os testes aprovados são verificações estáticas de arquivos. Não executam PostgreSQL RLS nem operações reais no Supabase Storage. Os quatro casos de integração continuam pendentes; portanto, o sucesso do CI não comprova isolamento real no banco.
- A branch ainda está sem proteção/required status checks no GitHub; o CI executa, mas o repositório não está configurado para exigir esses checks antes de um merge.

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


## Revisão automatizada de 27/11/2026

### Estado verificado

- No início desta revisão, a branch estava no commit `3767cbc0dbdc4eeed4f4c711f290c1c7c6c46a84`; a comparação com a referência da branch não indicava commits posteriores.
- Última execução de Actions localizada: [run #44782781249](https://github.com/ivancm347/ConectaBrasil/actions/runs/44782781249), em 20/11/2026. O job `checks` terminou com sucesso.
- Logs: `npm test` registrou 39 testes, 35 aprovados, 4 `TODO`, 0 falhas; `npm run build` concluiu. `npm install` reportou 0 vulnerabilidades.
- O build emitiu aviso de chunk JavaScript acima de 500 kB; não impediu a conclusão.
- Limitação de rastreabilidade: o log dessa execução fez checkout do SHA `56677a3f8c782653d0572ff7e0ae1cc23c47e916` (referência do evento do workflow). Não foi localizada execução associada diretamente ao commit da branch consultado. Portanto, esse resultado não deve ser apresentado como execução confirmada do novo conteúdo desta revisão.

### Regressão encontrada e corrigida na branch

Os scripts SQL manuais legados podiam desfazer as proteções das migrations:

- `supabase/business_images.sql` recriava policies de Storage mais permissivas: leitura sem validar a pasta do proprietário e escrita baseada apenas no UID da primeira pasta.
- `supabase/fix_business_image_access.sql` substituía `can_view_business_image` por uma versão antiga, sem validar a pasta do proprietário e sem exigir mercado confiável para leitura privada.

Alterações preparadas somente nesta branch:

- `business_images.sql` agora prepara colunas e bucket privado; não cria nem substitui policies. As policies ficam exclusivamente nas migrations versionadas.
- `fix_business_image_access.sql` foi marcado como descontinuado e falha intencionalmente com mensagem explicativa, sem alterar banco, função ou policies.
- `tests/security-contract.test.js` ganhou um contrato estático para impedir que esses scripts voltem a criar policies de Storage ou redefinir a função de leitura.

Commits desta revisão:
- `d174d1d5f155212c68e013cbbd0c4cc3595a6ddc` — remove policies do script de preparação.
- `c65c3162d8da502919da6f2d9b63f14d3410da7d` — desativa o script antigo de correção de leitura.
- `150c193adf3b874aa059ef0ccb4e197dcc836a84` — adiciona teste de regressão para scripts legados.
- `268a15e5f43c9e4a98727e2fed840773ee0da177` — corrige o escape das expressões regulares do novo teste.

**Atenção:** o novo teste ainda precisa ser executado pelo CI após esses commits. Não considerar a melhoria aprovada até existir execução verde.
- A suíte contém 40 declarações nos dois arquivos de teste: 6 em `tests/market.test.js` e 34 em `tests/security-contract.test.js`; são 36 testes executáveis e 4 `TODO`. Essa é uma contagem estática, não uma execução.
- A tentativa de clonar a branch para executar `npm test` e `npm run build` neste ambiente falhou por indisponibilidade de resolução DNS para `github.com`. O status combinado do novo commit não retornou checks e a consulta de execuções disponível não listou uma execução associada; portanto, o CI dos novos commits permanece **não confirmado**.


### Riscos ainda abertos

1. Os quatro testes de integração continuam como `TODO`: RLS entre proprietários, operações reais de Storage, isolamento BR/PY e visibilidade pública correta dos anúncios aprovados.
2. Os testes atuais são majoritariamente estáticos; não provam o comportamento real do PostgreSQL nem do Supabase Storage.
3. A policy de leitura de imagens permite leitura pública de imagens de anúncios aprovados, independentemente do mercado da sessão. Isso é coerente com a regra atual de conteúdo público, mas significa que a separação da vitrine não é confidencialidade entre países para URLs de imagens aprovadas. Se o requisito for restringir também a leitura direta de imagens por mercado, será necessária uma decisão de produto e uma alteração/teste específico.
4. O Custom Access Token Hook emite uma claim de primeiro nível `market_code`, enquanto as policies RLS/Storage leem `app_metadata.market_code`. O valor de origem é confiável, mas a claim de primeiro nível emitida pelo hook não é consumida pelas policies atuais. Confirmar no ambiente de desenvolvimento se o hook será usado como redundância ou se a arquitetura deve padronizar um único caminho de claim.
5. A configuração efetiva do hook no Supabase e os JWTs reais de usuários BR/PY ainda não foram validados nesta revisão.

### Próximo passo e bloqueios

- Aguardar CI para os três commits desta revisão.
- Preparar ambiente Supabase de desenvolvimento separado e implementar os quatro testes de integração com usuários reais de teste, sem usar `service_role` para simular proprietários.
- Não aplicar migrations, alterar dados/permissões de produção, fazer merge ou deploy.
- Manter `MARKETS.PY.enabled = false` até aprovação dos testes reais de isolamento.
