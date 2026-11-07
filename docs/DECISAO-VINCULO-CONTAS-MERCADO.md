# Decisão: vínculo inicial de mercado das contas

## Decisão aprovada

- A conta administrativa global mantém `app_metadata.role = admin` e não precisa de `market_code`. As políticas RLS devem reconhecer explicitamente o papel administrativo global.
- A conta de proprietário existente fica vinculada ao Brasil por `app_metadata.market_code = BR`.
- A conta de proprietário não poderá alterar seu próprio mercado pela aplicação, por `user_metadata`, rota, localStorage ou parâmetros enviados pelo navegador.
- O Paraguai permanece desativado até os testes de isolamento BR/PY serem aprovados.

## Como aplicar com segurança

A atribuição deve ser feita por um processo administrativo confiável usando Supabase Auth Admin API no servidor, nunca por atualização direta de `auth.users` via SQL e nunca expondo a service-role key no navegador.

O processo servidor deve:
1. Autenticar o administrador chamador e confirmar `app_metadata.role = admin`.
2. Identificar a conta de destino por UUID previamente conferido, não por e-mail fornecido livremente pelo cliente.
3. Definir somente `app_metadata.market_code = BR`, preservando os demais metadados existentes.
4. Registrar a ação em trilha de auditoria, sem gravar tokens ou segredos.
5. Não oferecer ao usuário comum uma operação de troca de mercado.

## Sequência antes de produção

1. Preparar e revisar a operação administrativa no servidor (Edge Function ou ambiente backend seguro).
2. Testar em projeto Supabase de desenvolvimento.
3. Aplicar a atribuição BR à conta de proprietário de teste.
4. Emitir um novo JWT e confirmar a claim `market_code = BR`.
5. Confirmar que o administrador global continua com acesso aos dois mercados sem depender dessa claim.
6. Só então habilitar o Custom Access Token Hook no projeto de teste e validar RLS, Storage, avaliações e métricas.
7. Não habilitar PY até todos os testes passarem.

## Limites desta decisão

Esta decisão não executa alterações em Auth, não atualiza contas, não cria nem habilita hooks e não modifica produção. A conta administrativa global não deve receber um mercado exclusivo: seu acesso aos dois mercados deve ser explicitamente tratado pelas políticas RLS e auditado.
