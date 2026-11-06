# Segurança e contexto dos mercados BR/PY — ConectaBrasil

## Estado
Documento de arquitetura. Não é uma autorização para executar SQL no Supabase de produção. As políticas e funções ainda precisam de migração integrada e testes reais.

## Decisões de produto já definidas

- `/br` apresenta a vitrine brasileira e `/py` apresentará a paraguaia.
- Anúncios aprovados são públicos por decisão explícita do produto. Visitantes anônimos podem consultar anúncios aprovados dos dois países pela API pública.
- O filtro de `country_code` na interface organiza a vitrine; **não é uma barreira de confidencialidade** e não impede que alguém consulte diretamente anúncios aprovados do outro país.
- Anúncios pendentes/rejeitados e operações de proprietário/administração continuam protegidos por RLS.
- Administrador global pode administrar os dois mercados e não deve receber um `market_code` exclusivo.
- Proprietários autenticados só podem criar e administrar anúncios do mercado confiavelmente vinculado à conta, definido por processo administrativo/server-side.
- Paraguai permanece desativado no frontend até a conclusão dos testes de segurança.

## Contexto confiável

A rota, query string, localStorage, cabeçalho arbitrário e `user_metadata` não podem autorizar operações de proprietário. A autorização de proprietário deve usar claim assinada derivada de `app_metadata` gerenciada no servidor, após validação do mecanismo de emissão de token em ambiente separado.

O Custom Access Token Hook preparado no repositório ainda não foi aplicado nem habilitado em produção. Sua compatibilidade com sessões autenticadas e anônimas deve ser testada antes de qualquer ativação.

Como a vitrine pública foi deliberadamente definida como pública para os dois países, não se deve tentar apresentar um filtro de rota como isolamento de API para visitantes anônimos. Se o produto futuramente exigir que visitantes anônimos não consigam consultar o outro país, será necessário mudar a arquitetura para um endpoint público server-side que valide o mercado solicitado sem expor credenciais privilegiadas.

## Modelo de autorização

1. **Anúncios:** manter leitura pública somente para anúncios aprovados. Para INSERT/UPDATE/DELETE de proprietário, exigir usuário autenticado, propriedade do anúncio, claim confiável válida e `country_code` correspondente. O proprietário não pode trocar o país do anúncio. Admin global continua com acesso aos dois mercados.
2. **Avaliações:** país herdado de `business_id`; envio de avaliação deve exigir anúncio aprovado e usuário autorizado. Avaliações aprovadas continuam públicas conforme decisão do produto. Moderação é exclusiva do admin global.
3. **Storage:** bucket permanece privado. Caminho esperado `<owner_uid>/<business_id>/...`; validar UID, existência do anúncio e propriedade. Leitura de imagem aprovada pode ser pública via autorização Storage; imagem pendente fica restrita ao proprietário/admin. Operações de proprietário devem validar também o mercado do anúncio.
4. **Métricas:** incremento público só para anúncio aprovado e métricas permitidas. Relatório administrativo deve verificar admin global, identificar país e permitir escopo BR/PY; revogar EXECUTE de anon em relatório administrativo.
5. **Auditoria:** registrar ações administrativas e escopo/país quando aplicável, sem tokens ou segredos.
6. **Cache/frontend:** manter filtros por `country_code` e separar chaves de cache/favoritos por mercado. Isso é consistência da interface, não substitui RLS.

## Atenção às políticas RLS existentes

Políticas permissivas são combinadas por OR. Criar uma policy permissiva nova não restringe uma policy antiga mais ampla. A migração integrada deve inventariar e substituir cuidadosamente as policies antigas de INSERT/UPDATE/DELETE e Storage, mantendo as leituras públicas deliberadas. Não aplicar somente a migração atual de propriedade de imagens como se ela completasse o isolamento por país.

Funções SECURITY DEFINER precisam de revisão individual, incluindo `can_view_business_image`, `increment_business_metric` e `get_admin_business_metrics`. Verificar também grants EXECUTE, search_path e validação de argumentos.

## Testes obrigatórios em ambiente de desenvolvimento

- Proprietário BR cria/edita somente anúncios BR; payload tentando gravar PY é negado.
- Proprietário PY cria/edita somente anúncios PY.
- Alterar rota, localStorage ou user_metadata não muda a autorização.
- Proprietário A não edita/exclui anúncios pendentes nem imagens privadas do proprietário B.
- Upload/update/delete exige pasta UID correta e business_id pertencente ao usuário.
- Anúncios aprovados de ambos os países permanecem consultáveis publicamente, conforme decisão de produto; não afirmar isolamento anônimo entre países.
- Imagens aprovadas continuam acessíveis pela autorização Storage; imagens pendentes ficam restritas.
- Avaliações são vinculadas ao anúncio correto; envio/moderação respeita permissões.
- Métricas aceitam somente nomes permitidos e anúncios aprovados; relatório administrativo identifica e filtra país.
- Anon não executa relatório administrativo.
- Admin global opera ambos os países e ações ficam auditadas.
- Renovação de JWT mantém claim confiável; ausência de claim não concede autorização de proprietário.
- Regressão do Brasil passa antes de habilitar qualquer operação PY.

## Bloqueios e sequência

1. Confirmar um projeto Supabase de desenvolvimento separado ou clone seguro. Ainda não foi confirmado nesta sessão.
2. Comparar schema/policies reais com as migrations versionadas.
3. Preparar uma migration integrada, não destrutiva, que substitua explicitamente as policies antigas necessárias.
4. Testar RLS, Storage, RPCs e emissão/renovação de JWT com contas BR/PY separadas.
5. Revisar diff e plano de reversão.
6. Só depois preparar implantação em produção e habilitar PY após aprovação dos testes.

Não alterar preços, planos, pagamentos ou dados existentes nesta etapa. Não atualizar diretamente `auth.users` por SQL e nunca expor service-role no frontend.
