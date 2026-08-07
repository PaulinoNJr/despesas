# Conta Clara

Aplicação PWA para acompanhar receitas, contas fixas e despesas flutuantes.

## Desenvolvimento

```bash
npm install
npm run dev
```

## Supabase

1. Crie um projeto no Supabase e execute [`supabase/schema.sql`](./supabase/schema.sql) no SQL Editor.
2. Copie `.env.example` para `.env.local` e preencha URL e chave anônima.
3. Para uma versão de produção com múltiplas contas, configure autenticação e políticas RLS antes de expor o banco.

Sem essas variáveis, a aplicação mantém os dados apenas neste navegador, permitindo testar toda a interface.

## Vercel

Importe o repositório na Vercel, cadastre `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nas variáveis de ambiente e faça o deploy. O comando de build é `npm run build` e a pasta de saída é `dist`.
