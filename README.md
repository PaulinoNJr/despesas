# Conta Clara

Aplicação PWA para acompanhar receitas, contas fixas e despesas flutuantes.

## Desenvolvimento

```bash
npm install
npm run dev
```

## Supabase

1. No Supabase, ative **Authentication > Providers > Anonymous sign-ins** e execute [`supabase/schema.sql`](./supabase/schema.sql) no SQL Editor.
2. Copie `.env.example` para `.env.local` e preencha URL e a **Publishable key**. A chave legada `VITE_SUPABASE_ANON_KEY` também é aceita.
3. A aplicação cria uma sessão anônima por navegador e o banco usa RLS para isolar os dados. Não limpe os dados do navegador se quiser preservar o acesso a essa sessão; a próxima evolução recomendada é login por e-mail.

Sem essas variáveis, a aplicação mantém os dados apenas neste navegador, permitindo testar toda a interface.

## Vercel

Importe o repositório na Vercel, cadastre `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` nas variáveis de ambiente e faça o deploy. O comando de build é `npm run build` e a pasta de saída é `dist`.
