# Conta Certa

Aplicação PWA para acompanhar receitas, contas fixas e despesas flutuantes.

## Desenvolvimento

```bash
npm install
npm run dev
```

## Supabase

1. Execute somente [`supabase/setup.sql`](./supabase/setup.sql) no SQL Editor. O arquivo funciona para uma base nova ou para atualizar uma versão anterior sem remover lançamentos.
2. Copie `.env.example` para `.env.local` e preencha URL e a **Publishable key**. A chave legada `VITE_SUPABASE_ANON_KEY` também é aceita.
3. Crie os acessos em **Authentication > Users** no painel do Supabase. A aplicação usa e-mail e senha e o banco usa RLS para isolar os dados de cada usuário.

Sem essas variáveis, a aplicação mantém os dados apenas neste navegador, permitindo testar toda a interface.

Depois disso, desative **Anonymous sign-ins** e **Enable sign ups** em **Authentication > Providers > Email**, pois os usuários são criados manualmente pelo administrador.

### Checklist de segurança

- Use exclusivamente `VITE_SUPABASE_URL` e a **Publishable key** no navegador. Nunca cadastre `service_role`, chave secreta, senha de banco ou token administrativo na Vercel ou no código do front-end.
- Aplique o SQL correspondente acima: ele habilita e reforça RLS, restringe as permissões do papel anônimo e confere se os relacionamentos pertencem ao mesmo usuário.
- Se você tinha dados antes da coluna `owner_id`, vincule os registros antigos ao seu usuário antes de publicar. No SQL Editor, troque o e-mail e execute:

```sql
update public.people set owner_id = (select id from auth.users where email = 'seu@email.com') where owner_id is null;
update public.bills set owner_id = (select id from auth.users where email = 'seu@email.com') where owner_id is null;
```

- Em **Authentication > Password Security**, habilite a proteção contra senhas vazadas e exija senhas fortes. Em **Authentication > Sessions**, defina tempo de inatividade, duração máxima e, se fizer sentido para sua casa, uma sessão por usuário.
- Execute o **Security Advisor** do Supabase após a migração e corrija qualquer alerta pendente.

### Face ID, digital e Passkeys

O acesso biométrico usa Passkeys do Supabase, com desafio verificado pelo servidor; ele não armazena uma credencial de desbloqueio apenas no navegador.

1. Em **Authentication > Passkeys**, ative o recurso e informe o nome do app.
2. Configure o RP ID com o domínio estável do deploy (sem `https://`) e inclua as origens autorizadas, por exemplo `https://seu-projeto.vercel.app` e o domínio customizado.
3. Publique em HTTPS. Depois, cada usuário pode adicionar e remover suas chaves em **Configurações** e entrar com Face ID, Touch ID, Windows Hello ou digital.

## Vercel

Importe o repositório na Vercel, cadastre `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` nas variáveis de ambiente e faça o deploy. O comando de build é `npm run build` e a pasta de saída é `dist`. O arquivo [`vercel.json`](./vercel.json) envia cabeçalhos de segurança, incluindo CSP e bloqueio de incorporação em iframes.
