# Isolamento real dos mercados BR/PY — decisão de segurança

## Estado
Este documento orienta a próxima etapa. Não é uma autorização para executar SQL no projeto Supabase de produção. Nenhuma política é alterada por este documento.

## Problema identificado
O aplicativo atualmente escolhe o mercado pela rota `/br` ou `/py` e filtra consultas no frontend usando o campo legado `businesses.country`. Isso organiza a interface, mas não é uma fronteira de segurança: um cliente pode alterar a rota, os parâmetros de consulta ou chamar a API do Supabase diretamente.

As políticas RLS existentes permitem leitura pública de qualquer anúncio aprovado. A função `can_view_business_image(text)` também autoriza leitura de imagem quando o anúncio está aprovado, sem validar país. As avaliações e métricas também não têm uma fronteira BR/PY.

## Regra obrigatória
O país ativo não pode ser aceito de um parâmetro livre enviado pelo navegador, de query string, de localStorage, de cabeçalho arbitrário ou somente do caminho da URL.

A autorização precisa usar uma identidade de mercado emitida/validada por componente confiável no servidor. A implementação escolhida deve garantir:
- mercado BR ou PY em claim assinado e validado pelo Supabase; ou
- leitura pública por endpoint servidor controlado que valida o mercado e não expõe credenciais privilegiadas ao navegador.

Não colocar service-role key no frontend. Não confiar em `user_metadata` editável pelo usuário para autorização. Um campo em `app_metadata` também só é confiável se for definido por fluxo administrativo/servidor e não pelo cliente.

## Modelo de autorização proposto
1. Usuários proprietários: cada anúncio tem `country_code`; o proprietário só pode criar/alterar anúncios no mercado autorizado para sua conta. Não permitir que o cliente troque o país do anúncio.
2. Administrador global: pode administrar ambos os mercados, com auditoria.
3. Leitura pública: somente anúncios aprovados no mercado autorizado para aquela requisição.
4. Storage: o caminho precisa corresponder a proprietário + ID do anúncio, e o anúncio deve estar aprovado ou pertencer ao usuário; a mesma autorização de mercado deve ser aplicada à leitura.
5. Avaliações: leitura e envio precisam pertencer ao mesmo mercado do anúncio.
6. Métricas: incrementos e relatórios precisam ser limitados ao mercado; relatório administrativo deve permitir filtro/escopo explícito e auditável.
7. Categorias: continuam compartilhadas; vínculos herdam o mercado do anúncio.

## Pré-requisitos antes de uma migração que substitua RLS
- Definir e implementar como o mercado confiável será emitido para visitante anônimo e usuário autenticado.
- Definir como o mercado será vinculado à conta de proprietário; um mesmo login não pode escolher outro país apenas alterando a interface.
- Coordenar frontend e backend para enviar `country_code` nos novos cadastros.
- Migrar/validar todos os anúncios legados sem atribuir país por suposição.
- Revisar políticas permissivas existentes: políticas permissivas são combinadas com OR; adicionar uma nova política restritiva sem remover/substituir as antigas não fecha o acesso.
- Revisar funções SECURITY DEFINER e grants, em especial `can_view_business_image`, `increment_business_metric` e `get_admin_business_metrics`.
- Executar testes com dois proprietários e visitantes separados em ambiente de desenvolvimento.

## Testes de aceitação obrigatórios
- Token/mercado BR não consegue consultar anúncio PY por REST, mesmo conhecendo UUID e slug.
- Token/mercado PY não consegue consultar anúncio BR.
- Usuário A não consegue ler/alterar/excluir anúncio ou imagem do usuário B.
- Upload com UID correto, mas business_id de outro proprietário, é negado.
- Renomear/mover objeto para pasta de outro usuário é negado.
- Imagem de anúncio aprovado só pode ser lida no mercado autorizado.
- Imagem de anúncio pendente só pode ser lida pelo proprietário e administrador autorizado.
- Avaliação aprovada não vaza entre mercados; envio para anúncio de outro mercado é negado.
- RPC de métricas não permite incrementar anúncio fora do mercado e relatório não mistura países.
- Administrador global consegue operar ambos os mercados e suas ações ficam auditadas.

## Bloqueio de lançamento
Paraguai permanece `enabled: false` até todos os testes acima passarem. A existência de testes estáticos que leem o texto SQL não prova que o PostgreSQL/RLS/Storage bloqueiam as operações reais.
