# Revisão de segurança RLS — mercados BR/PY

**Status:** diagnóstico e desenho proposto. Nenhuma política foi alterada e nenhum SQL foi executado no Supabase.

## 1. Estado atual confirmado

A tabela `public.businesses` possui o campo legado `country` (`text NOT NULL DEFAULT 'Brasil'`), mas ainda não possui `country_code`. A migração aditiva `20261106090000_add_business_country_code.sql` está apenas no repositório e não foi aplicada.

As políticas atuais de `businesses` são:

- **Admins manage businesses:** acesso global para JWT com `app_metadata.role = admin`.
- **Approved businesses are public:** SELECT permite qualquer anúncio aprovado, sem restrição de país.
- **Owners create pending businesses:** proprietário autenticado pode criar anúncio pendente.
- **Owners delete own pending businesses:** proprietário pode excluir o próprio anúncio pendente.
- **Owners update own pending businesses:** proprietário pode atualizar o próprio anúncio pendente.

As tabelas relacionadas (`business_categories`, `business_reviews` e `business_metric_events`) e a função `can_view_business_image` também precisam ser avaliadas para que o país não seja contornado por relações, métricas ou imagens.

## 2. Risco identificado

O caminho `/br` ou `/py`, o estado React e os filtros do Supabase JS são controlados pelo navegador. Portanto, **não são uma identidade de país confiável para RLS**.

Adicionar apenas `.eq('country', 'Brasil')` no frontend melhora a separação visual, mas não impede que alguém altere a consulta e solicite outro país diretamente à API.

Também não devemos usar `user_metadata` como autorização: o próprio usuário pode editar metadados desse tipo. Qualquer claim de país usado como autorização precisa ser emitido/gerenciado por uma fonte confiável do servidor.

## 3. Decisão arquitetural necessária antes de escrever políticas

Há duas opções seguras, com impactos diferentes:

### Opção A — um único projeto Supabase

Exige uma fonte confiável de contexto de mercado para cada requisição. Para usuários autenticados, pode ser uma associação de país gerenciada no servidor e refletida em claim confiável do JWT. Para visitantes anônimos, é necessário um mecanismo de contexto assinado/validado no servidor ou uma camada de API/Edge Function que faça a consulta pública.

Não basta enviar `country=BR` como parâmetro do navegador. Também será necessário decidir como o administrador global acessará ambos os mercados e se um proprietário poderá atuar nos dois países.

### Opção B — um projeto Supabase por país

Cada aplicação/mercado usa seu próprio projeto, chaves públicas, banco, Storage e políticas. É a separação mais simples de demonstrar e testar em RLS, mas exige duplicar infraestrutura e planejar uma visão administrativa consolidada por integração de servidor.

## 4. Regras que deverão ser cobertas no desenho final

1. Anúncios: leitura pública apenas do mercado servido; proprietário só gerencia os próprios registros; admin global ou admin por país conforme regra definida.
2. `business_categories`: acesso sempre derivado do anúncio pai, sem confiar em país enviado pelo cliente.
3. `business_reviews`: leitura e moderação vinculadas ao anúncio e ao seu mercado.
4. `business_metric_events`: leitura administrativa limitada ao mercado autorizado; métricas só podem ser incrementadas para anúncio aprovado do mesmo contexto.
5. Storage `business-images`: validar bucket, proprietário, anúncio pai e mercado; não liberar objetos só porque o caminho contém um identificador.
6. Categorias: definir se serão compartilhadas com traduções ou se terão visibilidade por mercado.
7. Auditoria: registrar o mercado da ação e manter a visão global apenas para administrador autorizado.

## 5. Testes obrigatórios antes de habilitar PY

- Visitante BR não consegue obter anúncios PY pela API.
- Visitante PY não consegue obter anúncios BR pela API.
- Proprietário BR não consegue criar, editar, excluir ou anexar imagens a anúncio PY.
- Proprietário PY não consegue operar anúncios BR.
- Usuário comum não consegue se promover a administrador nem alterar seu país autorizado.
- Admin de país não consegue operar o outro país, caso seja adotada administração segmentada.
- Admin global consegue operar ambos, com trilha de auditoria.
- Reviews, categorias relacionadas, métricas e Storage respeitam as mesmas regras.
- Testes repetidos com chamadas diretas à API, não apenas pela interface.

## 6. Próxima ação recomendada

Antes de produzir SQL de políticas, confirmar a decisão entre **um projeto Supabase compartilhado com contexto confiável de mercado** ou **um projeto separado por país**. A política atual não deve ser substituída por um filtro baseado somente na rota do navegador.

**Até essa decisão:** manter PY desativado, não aplicar a migração de `country_code` em produção e não alterar políticas RLS/Storage.
