# Decisão técnica: contexto confiável de mercado

## Objetivo

Definir o que o banco deve proteger e como o mercado será determinado sem tratar a rota do navegador como prova de autorização.

## Distinção essencial: conteúdo público x dados privados

Os anúncios aprovados foram definidos como públicos. Portanto, se qualquer pessoa pode abrir a vitrine PY, o conteúdo aprovado do Paraguai não é secreto nem pode ser considerado inacessível a visitantes brasileiros. Uma rota /br pode filtrar a vitrine para exibir BR por padrão, mas não transforma o conteúdo aprovado de PY em dado privado.

Não existe uma forma confiável de impedir que um visitante anônimo escolha /py ou chame uma API pública de PY apenas com base no país declarado pelo próprio navegador. Geolocalização por IP pode ajudar na experiência, mas não é identidade nem controle de segurança.

Assim, a regra tecnicamente coerente com a decisão de que anúncios aprovados são públicos é:
- Separação BR/PY nas vitrines e consultas normais da interface.
- RLS protege anúncios pendentes/rejeitados, dados do proprietário e operações administrativas.
- Nenhuma credencial privilegiada é enviada ao navegador.
- Não afirmar que anúncio aprovado de outro mercado é inacessível pela API a visitantes anônimos.

## Contexto confiável para operações autenticadas

Para proprietários, o país da conta deve ser definido por processo administrativo/servidor e armazenado em metadado protegido (por exemplo, app_metadata), nunca em user_metadata editável pelo usuário.

Uma opção a validar no Supabase é um Custom Access Token Hook que inclua uma claim de mercado emitida a partir desse metadado confiável. As políticas e funções no PostgreSQL validariam essa claim assinada. A claim não deve ser aceita se vier de parâmetro, cabeçalho arbitrário ou dado editável pelo cliente.

- Conta proprietária BR: pode criar e gerenciar somente registros BR próprios.
- Conta proprietária PY: pode criar e gerenciar somente registros PY próprios.
- Administrador global: pode operar BR e PY, com trilha de auditoria.
- Trocar a rota não altera a claim nem o país autorizado da conta.

Antes de adotar Custom Access Token Hook, confirmar compatibilidade com o fluxo atual de Auth, tokens anônimos, sessões existentes e papéis administrativos. Não alterar app_metadata nem criar hook em produção nesta etapa.

## Visitantes anônimos

O token anônimo padrão do Supabase não representa, por si só, um país confiável. Para os anúncios aprovados, manter a leitura pública conforme a regra de produto. O filtro country_code no cliente seleciona a vitrine apresentada, não restringe o alcance público da API.

Se o produto passar a exigir bloqueio real de leitura anônima entre mercados, será necessária uma decisão de produto adicional: visitantes precisarão receber uma identidade/atribuição de mercado controlada pelo servidor, ou a leitura pública deverá passar por uma camada de API própria. Mesmo assim, não se deve confundir preferência de mercado escolhida pelo visitante com uma barreira de confidencialidade. Conteúdo que precisa ser secreto não pode ser publicado como anúncio aprovado.

## Sequência segura de implementação

1. Inspecionar a configuração atual de Supabase Auth e confirmar disponibilidade/limitações do Custom Access Token Hook.
2. Definir como o país da conta de proprietário será atribuído e alterado somente por administração.
3. Especificar políticas RLS para proprietário, pendentes, avaliações, Storage e métricas, preservando a leitura pública de anúncios aprovados.
4. Escrever testes de integração em ambiente Supabase de desenvolvimento com dois proprietários e administrador.
5. Validar regressões do mercado BR.
6. Manter PY desativado até os testes passarem.

## Estado

Esta é uma decisão de arquitetura para orientar implementação. Não cria hooks, não altera Auth, RLS, Storage, dados ou permissões. Nenhuma migração foi aplicada em produção.