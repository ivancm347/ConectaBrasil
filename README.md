# Conecta Brasil 🇧🇷

**Conexões que movimentam.**

O Conecta Brasil conecta pessoas, empresas, profissionais, lojas e serviços. A plataforma começa pela Baixada Santista e está preparada para crescer em todo o país.

## Recursos implementados
- Página inicial responsiva.
- Busca por texto e cidade e filtros por categoria.
- Integração com Supabase para exibir apenas negócios aprovados.
- Cadastro e login de anunciantes por e-mail e senha.
- Envio de negócios para análise, com status inicial pendente.
- Painel administrativo para aprovar, rejeitar, suspender e devolver cadastros para análise.
- Visitantes podem explorar a vitrine sem fazer login.

## Tecnologias
- React 18 e Vite
- Supabase Auth e PostgreSQL com Row Level Security (RLS)
- Lucide React
- GitHub Actions e GitHub Pages

## Configuração do Supabase
1. Crie um projeto no Supabase.
2. Execute o arquivo `supabase/schema.sql` no SQL Editor.
3. No GitHub, abra **Settings → Secrets and variables → Actions**.
4. Crie as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com os dados do projeto Supabase. A chave usada no navegador deve ser a chave pública/anon (publishable); nunca coloque a `service_role` ou secret key no frontend.
5. Confirme em **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Habilitar a conta administradora
A conta precisa existir primeiro em **Authentication → Users**. Depois, no SQL Editor do Supabase, substitua o texto de exemplo pelo e-mail da conta que será administradora e execute:

```sql
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'SEU_EMAIL_DE_LOGIN';
```

O painel verifica a função em `app_metadata.role` e o banco também valida essa função nas políticas RLS. Não use `user_metadata` para conceder privilégios. Depois de alterar a função, saia da conta no site e entre novamente para renovar a sessão.

## Rodar localmente
```bash
npm install
npm run dev
```

## Gerar versão de produção
```bash
npm run build
npm run preview
```

## Segurança
- Os visitantes anônimos só podem consultar negócios aprovados.
- O anunciante autenticado pode enviar e acompanhar os próprios cadastros.
- A aprovação e a moderação são protegidas por políticas RLS.
- O papel administrativo deve ser concedido somente pelo painel seguro do Supabase/SQL Editor.
- Nunca exponha a chave `service_role` no navegador ou em variáveis `VITE_*`.

## Próximas etapas
1. Página pública detalhada de cada negócio.
2. Edição dos dados pelo anunciante.
3. Melhorias na busca por localização.
4. Denúncias e ferramentas de qualidade da vitrine.
5. Avaliações, favoritos e anúncios em destaque.

---
Conecta Brasil — um país inteiro de possibilidades.
