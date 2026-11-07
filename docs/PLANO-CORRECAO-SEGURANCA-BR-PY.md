# Plano de correção de segurança BR/PY — ConectaBrasil

Branch: `feature/arquitetura-internacional`  
Status: plano de implementação e validação; **não é uma migração executável**.  
Ambiente: a coluna `businesses.country_code` já foi confirmada em produção com NOT NULL, default BR, CHECK BR/PY e índice. As demais alterações descritas aqui ainda não foram aplicadas.

## 1. Decisões de produto que a implementação deve respeitar

- `/br` apresenta anúncios aprovados BR; `/py` apresenta anúncios aprovados PY.
- Anúncios aprovados são públicos. Portanto, um visitante anônimo pode consultar anúncios aprovados dos dois países pela API pública; o filtro da rota organiza a vitrine, mas não é uma barreira de confidencialidade.
- Anúncios pendentes/rejeitados e operações de proprietário/administração permanecem protegidos por RLS.
- Administrador global (`app_metadata.role = admin`) pode administrar BR e PY, com auditoria, sem receber `market_code` exclusivo.
- Proprietários autenticados devem ter `app_metadata.market_code` definido por processo administrativo/server-side. A rota, localStorage, query string, cabeçalho arbitrário e `user_metadata` nunca autorizam o mercado.
- PY permanece desativado até os testes de integração descritos abaixo passarem.

## 2. Evidências confirmadas no projeto de produção

### businesses
- A coluna `country_code` existe, é `text NOT NULL`, default `'BR'`.
- A constraint aceita somente `BR` e `PY`.
- O índice `(country_code, status, city)` existe.
- Políticas atuais: admin global ALL; SELECT público para aprovados, proprietário e admin; INSERT/UPDATE/DELETE de proprietário limitado a anúncios pendentes, mas sem validar o mercado da conta.

### business_reviews
- INSERT exige usuário autenticado, `user_id = auth.uid()`, status pending e anúncio aprovado.
- SELECT permite avaliações aprovadas, próprias e admin global.
- UPDATE de moderação permite admin global.
- As políticas ainda não verificam o mercado do proprietário ao enviar/moderar. O país deve ser derivado do anúncio por `business_id`, evitando duplicar país na avaliação.

### business_metric_events e RPCs
- A tabela permite SELECT ao admin global.
- `increment_business_metric(uuid,text)` é SECURITY DEFINER, permite apenas `views_count` e `whatsapp_clicks`, incrementa qualquer anúncio aprovado e registra evento. EXECUTE está concedido a anon, authenticated, postgres e service_role.
- `get_admin_business_metrics(date)` é SECURITY DEFINER e verifica admin no corpo, mas EXECUTE também está concedido a anon. O relatório atual agrega os dois mercados sem identificar/filtrar país.
- As métricas devem continuar derivadas do anúncio. O relatório administrativo precisa expor o país e permitir escopo explícito BR/PY, com autorização de admin global. EXECUTE para anon deve ser revogado do relatório.

### Storage
- Bucket `business-images` existe e é privado.
- INSERT/UPDATE/DELETE atuais verificam somente a primeira pasta = UID; não verificam se a segunda pasta identifica anúncio pertencente ao usuário.
- SELECT chama `public.can_view_business_image(text)`, que autoriza anúncio aprovado, proprietário ou admin global, mas não valida o vínculo da pasta com o proprietário nem contexto de mercado do proprietário.
- A migração `20261106120000_secure_business_image_ownership.sql` preparada no repositório reforça o vínculo do objeto com proprietário + anúncio para INSERT/UPDATE/DELETE, mas ainda precisa de revisão integrada e não resolve a função SELECT nem o mercado. Não aplicar isoladamente como se concluísse o isolamento.

### Auth e mercado confiável
- A conta consultada pelo e-mail administrativo existe com `app_metadata.role = admin` e sem `market_code`; isso é intencional para admin global.
- O UUID de proprietário previamente anotado não foi localizado em `auth.users`; não atribuir mercado a essa conta até identificar a conta correta por processo seguro.
- `public.custom_access_token_hook(jsonb)` ainda não existe em produção e não foi habilitado no Dashboard.
- A migração do Hook preparada no repositório copia `market_code` somente de `app_metadata` para claim assinada; deve ser validada primeiro em ambiente de desenvolvimento, inclusive compatibilidade com sessões e tokens anônimos.

## 3. Implementação proposta — não executar ainda

1. **Auth:** validar o Custom Access Token Hook em projeto de desenvolvimento; confirmar grants mínimos para `supabase_auth_admin`, emissão/renovação de JWT e ausência de impacto em sessões anônimas. Não habilitar em produção antes disso.
2. **Vínculo de proprietário:** identificar a conta real de proprietário e atribuir BR somente via função/serviço administrativo no servidor, preservando metadados. Nunca atualizar `auth.users` diretamente por SQL. Não alterar a conta admin global.
3. **businesses RLS:** manter leitura pública de anúncios aprovados. Para INSERT/UPDATE/DELETE de proprietário, exigir `auth.uid() = owner_id`, claim confiável `market_code` válida e `country_code = claim`; impedir que proprietário altere o país. Admin global continua com acesso explícito a ambos.
4. **business_reviews RLS:** validar que o anúncio relacionado pertence ao mercado autorizado para operações de proprietário; manter leitura pública de avaliações aprovadas conforme a regra pública; preservar moderação pelo admin global.
5. **Storage:** validar caminho `<owner_uid>/<business_id>/...` e existência do anúncio. SELECT permite imagens de anúncios aprovados publicamente, ou imagens privadas ao proprietário/admin autorizado; para operações de proprietário, confirmar claim e país do anúncio. Não tornar o bucket público.
6. **Métricas:** manter a RPC pública de incremento apenas para anúncios aprovados e métricas permitidas; avaliar proteção contra abuso/rate limiting. O relatório administrativo deve verificar admin global e retornar país/escopo solicitado. Revogar EXECUTE de `anon` em `get_admin_business_metrics`; conceder somente a authenticated e service_role conforme necessidade real.
7. **Auditoria:** registrar ações administrativas com ator, ação, entidade e país/escopo, sem gravar tokens ou segredos.
8. **Frontend/cache:** confirmar filtros BR/PY em consultas públicas e separar chaves de cache/favoritos por mercado; isso é consistência da interface, não substitui RLS.

## 4. Testes obrigatórios em ambiente de desenvolvimento

- Proprietário BR cria/edita somente anúncio BR; tentativa de PY é negada mesmo alterando rota, payload, localStorage ou user_metadata.
- Proprietário PY cria/edita somente anúncio PY.
- Proprietário A não lê/edita/exclui anúncio pendente ou imagem privada de proprietário B.
- Upload, update e delete exigem pasta UID correta e business_id pertencente ao mesmo usuário.
- Anúncios e avaliações aprovados continuam públicos, conforme decisão de produto; não declarar que API anônima bloqueia o outro país.
- Imagens de anúncios aprovados continuam acessíveis pelo bucket privado via autorização Storage; imagens pendentes ficam restritas.
- Métricas só aceitam nomes permitidos e anúncios aprovados; relatório administrativo identifica país e não mistura resultados quando solicitado escopo BR ou PY.
- Anon não executa relatório administrativo.
- Admin global opera ambos os países e ações ficam auditadas.
- Renovação de JWT mantém claim correta; ausência de claim não concede autorização de proprietário.
- Executar testes de regressão do Brasil antes de habilitar qualquer operação PY.

## 5. Bloqueios e sequência

- Não há projeto Supabase de desenvolvimento confirmado nesta sessão. Não aplicar novas migrações de segurança em produção com base apenas em revisão estática.
- A coluna `country_code` já foi aplicada e verificada; não repetir sua migração.
- Não aplicar isoladamente as migrações de Storage ou Hook existentes antes da revisão integrada e testes.
- Não alterar preços, planos, pagamentos, registros existentes ou bucket.
- Não habilitar PY até todos os testes de integração passarem.

## 6. Próxima ação técnica

Obter/validar um ambiente de desenvolvimento Supabase separado ou um clone seguro, aplicar nele as migrações integradas, executar os testes acima e revisar o diff final. Só então preparar uma janela de implantação em produção, com backup/exportação prévia e plano de reversão.
