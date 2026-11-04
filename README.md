# Conecta Brasil 🇧🇷

**Conexões que movimentam.**

O Conecta Brasil é uma plataforma em desenvolvimento para aproximar pessoas, empresas, profissionais, lojas e serviços de suas comunidades, começando pela Baixada Santista e preparada para crescer em todo o país.

## Primeira versão
- Página inicial responsiva para celular e computador.
- Busca visual e filtros por categoria.
- Categorias de empresas, comércio, serviços e construção.
- Estrutura inicial de vitrine e apresentação do projeto.
- Preparação para integração futura com Supabase e cadastro real de anunciantes.

> Esta primeira entrega é uma prévia visual. Os cartões exibidos são demonstrativos; ainda não representam empresas cadastradas. Busca por cidade, cadastro, avaliações e painel administrativo serão implementados nas próximas etapas.

## Tecnologias
- React 18
- Vite
- Lucide React
- GitHub Actions / GitHub Pages

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

## Publicação
O workflow em `.github/workflows/deploy.yml` gera e publica o site no GitHub Pages a cada atualização da branch `main`. Nas configurações do repositório, confirme **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Próximas etapas
1. Identidade visual e revisão da experiência mobile.
2. Projeto Supabase: tabelas, autenticação e regras de acesso.
3. Cadastro e edição de empresas e profissionais.
4. Busca por cidade, região e categoria.
5. Página pública de cada anunciante.
6. Painel administrativo, moderação e denúncias.
7. Avaliações, favoritos e anúncios em destaque.

---
Conecta Brasil — um país inteiro de possibilidades.
