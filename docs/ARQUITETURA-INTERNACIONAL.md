# Arquitetura internacional do CONECTA

## Objetivo

Preparar a plataforma atual para operar em mais de um país, começando por:

- Brasil: ConectaBrasil, português (pt-BR), real (BRL).
- Paraguai: Conecta Paraguay, espanhol (es), guarani (PYG).

A plataforma e a administração serão compartilhadas, mas os dados e a operação comercial de cada país permanecerão separados.

## Estado atual confirmado

- Aplicação React 18 + Vite em `src/main.jsx`.
- Supabase Auth, PostgreSQL, Storage e RLS.
- A tabela `public.businesses` já possui a coluna textual `country`, com padrão `Brasil`.
- O formulário atual e as consultas públicas foram desenvolvidos para o mercado brasileiro.
- A vitrine pública consulta negócios aprovados; o isolamento por país ainda não existe.
- A branch principal é `main`; esta implementação está isolada em uma branch de trabalho para não publicar mudanças incompletas.

## Princípios obrigatórios

1. Não apagar, recriar ou migrar destrutivamente cadastros existentes.
2. Todo registro brasileiro existente deve continuar identificado como Brasil.
3. Não misturar empresas, anúncios, avaliações, categorias ou métricas entre países.
4. Não confiar apenas em filtros do frontend: o isolamento também deve ser aplicado no banco por RLS e/ou funções seguras.
5. Não alterar preços, planos, pagamentos ou regras comerciais brasileiras nesta primeira etapa.
6. Não ativar pagamentos paraguaios até definir um meio de recebimento compatível.
7. Preservar o funcionamento atual da vitrine, cadastro, aprovação, avaliações, imagens e painel administrativo.

## Modelo de configuração por país

Cada país terá uma configuração central:

| Campo | Brasil | Paraguai |
|---|---|---|
| Código | BR | PY |
| Nome | Brasil | Paraguay |
| Idioma | pt-BR | es |
| Moeda | BRL | PYG |
| Símbolo | R$ | Gs. |
| Marca pública | ConectaBrasil | Conecta Paraguay |

Usar códigos estáveis (`country_code`, `locale`, `currency_code`) em vez de depender de textos livres ou símbolos de moeda.

## Estratégia de dados

- Adicionar `country_code` com padrão `BR` e preenchimento seguro dos registros existentes.
- Manter a coluna legada `country` durante a transição para compatibilidade.
- Fazer novas gravações receberem o país explicitamente a partir de uma configuração permitida.
- Criar índices para consultas por país e status.
- Revisar políticas RLS antes de permitir cadastros paraguaios.
- Definir como categorias e avaliações serão separadas ou compartilhadas, sem expor conteúdo de outro mercado.
- Não executar migração no projeto Supabase de produção sem revisão e confirmação do SQL final.

## Etapas de implementação

### Etapa 1 — Preparação (esta branch)
- Registrar arquitetura, regras de isolamento e sequência de implantação.
- Não alterar a branch principal nem o banco de produção.

### Etapa 2 — Banco compatível com múltiplos países
- Criar migração aditiva e reversível quando possível.
- Adicionar códigos de país, idioma e moeda.
- Garantir que os registros existentes permaneçam BR.
- Revisar RLS e índices.

### Etapa 3 — Contexto de país no aplicativo
- Criar configuração central BR/PY.
- Adicionar seletor de país.
- Manter Brasil como padrão para visitantes atuais, evitando mudança inesperada na experiência existente.
- Separar cache local por país.

### Etapa 4 — Vitrines e formulários
- Filtrar anúncios por país.
- Adaptar campos de estado/departamento, cidade e CEP/código postal.
- Localizar categorias, textos e mensagens.
- Manter o fluxo de aprovação administrativa.

### Etapa 5 — Administração
- Adicionar filtro de país no painel.
- Exibir indicadores e relatórios separados e consolidados.
- Restringir ações administrativas conforme permissões.

### Etapa 6 — Validação e lançamento
- Testar Brasil sem regressões.
- Testar Paraguai com cadastros fictícios.
- Validar isolamento no banco, Storage, avaliações, cache e relatórios.
- Só então planejar publicação e divulgação no Paraguai.

## Critérios de aceite

- Usuário brasileiro continua vendo e gerenciando somente o mercado BR.
- Usuário paraguaio vê somente o mercado PY.
- A troca de país não altera nem apaga dados.
- Cache, busca, avaliações, imagens e relatórios respeitam o país.
- O painel permite identificar claramente o país de cada anúncio.
- Nenhuma alteração é publicada em produção antes de testes e aprovação.
