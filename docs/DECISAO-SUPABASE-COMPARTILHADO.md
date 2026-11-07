# Decisão de arquitetura: Supabase compartilhado (BR/PY)

**Decisão:** adotar a opção A — um único projeto Supabase para Brasil e Paraguai.

**Projeto:** `ktppxqnwlhhopaxiflka`  
**Branch de desenvolvimento:** `feature/arquitetura-internacional`

## Objetivo

Manter um único aplicativo, uma única base Supabase e um painel administrativo comum, com dados de negócio identificados por país. A separação deve ser aplicada no banco e nas operações de servidor, não apenas nos filtros da interface.

## Regras acordadas

1. Brasil e Paraguai usam o mesmo projeto Supabase.
2. Cada anúncio terá país operacional explícito (`BR` ou `PY`).
3. País autorizado de uma conta não será lido de `user_metadata` nem aceito cegamente de parâmetros enviados pelo navegador.
4. Países autorizados e permissões administrativas serão atribuídos por processo confiável no servidor.
5. Proprietários só poderão criar e administrar anúncios nos países atribuídos à conta.
6. Administradores terão países explicitamente autorizados; o administrador global poderá ter BR e PY.
7. Relações, avaliações, métricas e arquivos do Storage herdarão a autorização do anúncio relacionado.
8. A interface continuará usando as rotas planejadas `/br` e `/py`, mas essas rotas não serão tratadas como prova de autorização.
9. PY continuará desativado até a implementação e os testes de isolamento.

## Atenção: leitura pública e contexto confiável

Os anúncios aprovados são públicos. Em um único domínio com rotas `/br` e `/py`, o caminho da URL é controlado pelo visitante e não prova, por si só, qual país ele está autorizado a consultar.

Portanto, antes de afirmar que visitantes anônimos estão tecnicamente impedidos de consultar o outro mercado, precisamos definir o requisito de produto:

- **Separação de experiência:** a interface mostra apenas o mercado selecionado, mas os anúncios aprovados continuam públicos pela API.
- **Isolamento estrito também para visitantes anônimos:** exige um sinal de mercado confiável no servidor. A rota do navegador ou um parâmetro `country=BR/PY` não atende a esse requisito. Será necessário escolher um mecanismo de identidade/contexto que não possa ser livremente solicitado para o outro mercado.

Não implementar uma política RLS que confie apenas em parâmetro do cliente ou em `user_metadata`.

## Estratégia técnica a projetar

- Criar uma associação de conta-país gerenciada no servidor, ou claims confiáveis equivalentes no JWT, para operações autenticadas.
- Definir uma tabela de permissões administrativas por país, mantendo o administrador global explicitamente autorizado em BR e PY.
- Para consultas públicas, decidir conscientemente entre visibilidade pública global e uma camada de servidor que aplique um contexto de mercado verificável.
- Substituir políticas RLS somente após mapear todas as tabelas, funções SECURITY DEFINER e políticas de Storage.
- Atualizar inserções para gravar tanto o legado `country` quanto `country_code` na mesma operação, depois da migração aprovada. Não deixar o default BR classificar silenciosamente anúncios PY.
- Criar testes negativos por API para provar que um usuário de um país não escreve nem administra dados do outro.

## Sequência segura

1. Confirmar a regra de leitura pública (experiência separada ou isolamento estrito).
2. Inventariar funções, triggers, grants, políticas e configurações de Auth necessárias.
3. Desenhar o modelo de permissões por país e o mecanismo de contexto confiável.
4. Preparar migrações e funções em branch, sem executar no projeto Supabase.
5. Revisar e aprovar o SQL.
6. Aplicar em ambiente controlado e testar com contas BR, PY e admin.
7. Só então habilitar o mercado PY.

## Estado atual

Esta decisão não aplica mudanças no banco. A migração de `country_code` permanece não executada; as políticas RLS e Storage permanecem como estão. O mercado PY permanece desativado.
