# Plano de testes de segurança — ConectaBrasil

Escopo: branch `feature/arquitetura-internacional`, mercados BR/PY e bucket privado `business-images`.

## Estado da automação

No estado inspecionado desta branch:
- `package.json` contém somente `dev`, `build` e `preview`; não há script de testes.
- Não foram encontrados `vitest.config.js` ou `playwright.config.js` nos caminhos verificados.
- Não foi encontrado `.github/workflows/ci.yml`.
- Não há evidência, nesta inspeção, de suíte automatizada para RLS, Storage ou isolamento entre países.
- O build não foi executado nesta revisão; não declarar aprovação.

## Regras de segurança que os testes devem provar

### RLS de anúncios
1. Visitante anônimo lê anúncio aprovado do mercado solicitado.
2. Visitante não lê anúncio pendente/rejeitado, salvo comportamento explicitamente autorizado.
3. Proprietário lê seus próprios anúncios pendentes.
4. Proprietário A não lê nem altera anúncios do proprietário B.
5. Usuário do mercado BR não acessa registros PY e vice-versa.
6. Administrador autorizado consegue consultar os dois mercados.
7. Tentativa de criar anúncio com país diferente do contexto confiável é recusada.
8. Alterar URL, caminho ou parâmetro de mercado no navegador não concede acesso ao outro país.

### Storage — bucket business-images
1. Upload é permitido somente quando a primeira pasta é o UID autenticado e a segunda pasta identifica anúncio existente do mesmo proprietário.
2. Upload para anúncio de outro proprietário é recusado.
3. Upload para ID inexistente é recusado.
4. Upload com UID de pasta diferente do usuário autenticado é recusado.
5. Update preserva as mesmas validações em USING e WITH CHECK; tentar mover objeto para pasta de outro usuário/anúncio é recusado.
6. Delete é permitido somente ao proprietário do anúncio vinculado.
7. Leitura de imagem aprovada respeita o país do anúncio e o contexto autorizado.
8. Leitura de imagem pendente é permitida somente ao proprietário e à administração autorizada.
9. URL pública não deve expor objetos do bucket privado; URLs assinadas devem expirar e ser geradas após autorização.
10. Caminhos antigos e URLs históricas continuam funcionando conforme política de compatibilidade, sem tornar o bucket público.

### Avaliações e métricas
1. Inserção de avaliação exige usuário autenticado e anúncio aprovado no mercado correto.
2. Usuário não altera/modera avaliação de terceiros.
3. Eventos de métricas não podem ser lidos por usuários comuns.
4. RPC de métricas só incrementa anúncio aprovado e não permite manipulação de outro mercado.
5. Relatório administrativo respeita o escopo global do administrador autorizado.

## Observações sobre a migração atual de Storage

Arquivo: `supabase/migrations/20261106120000_secure_business_image_ownership.sql`.

A migração restringe INSERT/UPDATE/DELETE verificando UID da pasta e vínculo com `businesses.owner_id`. Ela não implementa isolamento BR/PY e depende da política RLS de `businesses` permitir que a consulta correlacionada enxergue o anúncio do proprietário. Não aplicar em produção antes de testar no projeto de desenvolvimento com usuários e anúncios de teste de ambos os mercados.

A política de SELECT ainda depende de `can_view_business_image(name)`; essa função precisa ser revisada separadamente para escopo de país. Não tornar o bucket público como atalho.

## Pré-requisitos para testes executáveis

- Ambiente Supabase de desenvolvimento isolado, sem dados de produção.
- Dois usuários proprietários distintos e um administrador de teste.
- Pelo menos um anúncio aprovado e um pendente em cada mercado.
- JWTs de teste obtidos por autenticação normal; nunca armazenar tokens ou segredos no repositório.
- Testes de integração executados com credenciais de teste restritas. Não usar `service_role` para simular chamadas de usuários, pois ela pode contornar RLS.
- Asserções negativas explícitas (esperar 401/403/nenhuma linha) e positivas (acesso permitido ao dono/mercado correto).

## Critério para liberar Paraguay

Manter `MARKETS.PY.enabled = false` até que:
- o contexto do país seja confiável e validado no servidor/banco;
- RLS, Storage, avaliações e métricas estejam escopados por país;
- todos os casos negativos e positivos acima passem no ambiente de desenvolvimento;
- a compatibilidade do mercado BR seja validada;
- build e suíte automatizada estejam verdes.

## Segurança operacional

Este documento é um plano de teste, não prova de que os testes foram executados. Não aplicar migrações, alterar dados/permissões de produção, fazer merge ou deploy como parte desta revisão.
