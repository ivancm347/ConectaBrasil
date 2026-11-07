# Decisão: vitrines públicas BR/PY

## Decisão confirmada

A aplicação terá duas entradas de mercado:

- `/br`: a vitrine apresenta somente anúncios brasileiros com status `approved`.
- `/py`: a vitrine apresenta somente anúncios paraguaios com status `approved`.
- Anúncios pendentes ou rejeitados não aparecem na vitrine pública. O acesso a anúncios pendentes fica restrito ao proprietário e à administração autorizada.
- A administração global pode operar os dois mercados, identificando o país em cada registro e mantendo trilha de auditoria.
- Avaliações, imagens e métricas devem acompanhar o país do anúncio relacionado.

## Distinção entre vitrine e autorização

O filtro por rota e país organiza o conteúdo exibido pela interface. Ele não torna os anúncios aprovados privados nem impede, sozinho, que alguém consulte registros públicos diretamente pela API do Supabase.

Portanto:

1. Não considerar `/br`, `/py`, parâmetros de consulta, localStorage ou filtros React como controles de autorização.
2. Proteger no banco, por RLS e funções seguras, dados privados, anúncios não aprovados e operações de proprietário/administração.
3. Para garantir também que um visitante da vitrine BR não consiga consultar anúncios PY diretamente pela API (e vice-versa), será necessário um mecanismo servidor confiável que determine o mercado da requisição, ou uma camada pública de API/proxy com essa validação. Não colocar credenciais privilegiadas no navegador.
4. Até que esse mecanismo e os testes de integração estejam concluídos, não declarar isolamento forte entre mercados e não habilitar o Paraguai.

## Estado operacional

- Esta decisão é documentação de produto/arquitetura.
- Não altera banco, políticas RLS, Storage, dados, permissões ou publicação.
- O mercado PY continua desativado.
- A branch de trabalho permanece `feature/arquitetura-internacional`.
