# Migração 1 — Identificação do país dos anúncios

Arquivo: `supabase/migrations/20261106090000_add_business_country_code.sql`

## O que esta migração faz

- Adiciona `businesses.country_code`.
- Converte os valores conhecidos da coluna legada `country` para códigos BR/PY.
- Assume BR para registros vazios ou não reconhecidos, pois o mercado atual é Brasil.
- Define BR como padrão para novos registros enquanto o cadastro paraguaio não for habilitado.
- Restringe os códigos aceitos a BR e PY.
- Cria índice para consultas por país, status e cidade.
- Mantém a coluna `country` e não apaga nem altera os demais dados.

## O que ela NÃO faz

- Não altera o frontend.
- Não habilita ainda cadastros paraguaios.
- Não muda políticas RLS.
- Não muda planos, preços, pagamentos, moeda ou idioma.
- Não deve ser aplicada diretamente em produção nesta etapa.

## Procedimento obrigatório antes de produção

1. Fazer backup do projeto Supabase.
2. Executar em projeto de teste/staging.
3. Conferir a distribuição:
   `select country_code, count(*) from public.businesses group by country_code order by country_code;`
4. Conferir registros sem código:
   `select count(*) from public.businesses where country_code is null;`
5. Testar cadastro e edição brasileiros, aprovação, vitrine pública, avaliações e imagens.
6. Só planejar PY após revisar todas as tabelas relacionadas e as políticas RLS.

## Próxima etapa

Mapear todas as tabelas que armazenam dados ligados a empresas/anúncios e definir o isolamento por país antes de adicionar filtros no aplicativo. Não considerar o filtro visual do frontend uma barreira de segurança.
