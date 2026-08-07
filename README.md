# Conta Clara

Aplicação PWA para acompanhar receitas, contas fixas e despesas flutuantes.

## Desenvolvimento

```bash
npm install
npm run dev
```

## Supabase

1. Execute [`supabase/schema.sql`](./supabase/schema.sql) no SQL Editor. Se você já usava uma versão anterior, execute também a migração indicada abaixo.
2. Copie `.env.example` para `.env.local` e preencha URL e a **Publishable key**. A chave legada `VITE_SUPABASE_ANON_KEY` também é aceita.
3. Crie os acessos em **Authentication > Users** no painel do Supabase. A aplicação usa e-mail e senha e o banco usa RLS para isolar os dados de cada usuário.

Sem essas variáveis, a aplicação mantém os dados apenas neste navegador, permitindo testar toda a interface.

Se o banco já foi criado com uma versão mais antiga do projeto, execute também [`supabase/migrate-existing-project.sql`](./supabase/migrate-existing-project.sql). Depois disso, você pode desativar **Anonymous sign-ins** em Authentication, pois o app não o utiliza mais.

## Vercel

Importe o repositório na Vercel, cadastre `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` nas variáveis de ambiente e faça o deploy. O comando de build é `npm run build` e a pasta de saída é `dist`.
