-- Execute este arquivo no SQL Editor do seu projeto Supabase.
-- Para um aplicativo com vários usuários, adicione autenticação e políticas RLS
-- ligadas a auth.uid() antes de publicar.

create table if not exists public.people (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  salary numeric(12,2) not null check (salary >= 0),
  pay_day smallint not null check (pay_day between 1 and 31),
  color text not null default '#7067cf',
  created_at timestamptz not null default now()
);

create table if not exists public.bills (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  value numeric(12,2) not null check (value >= 0),
  due_day smallint not null check (due_day between 1 and 31),
  type text not null check (type in ('Fixa', 'Flutuante')),
  category text not null default 'Outros',
  responsible uuid references public.people(id) on delete set null,
  created_at timestamptz not null default now()
);

-- O pagamento é separado do lançamento para que uma conta recorrente fique
-- pendente novamente a cada novo mês.
create table if not exists public.bill_payments (
  bill_id uuid not null references public.bills(id) on delete cascade,
  period text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  status text not null default 'paid' check (status = 'paid'),
  paid_at timestamptz not null default now(),
  primary key (bill_id, period)
);

-- Segurança: cada usuário autenticado só enxerga os próprios dados.
alter table public.people enable row level security;
alter table public.bills enable row level security;
alter table public.bill_payments enable row level security;

create policy "people_owner_only" on public.people
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "bills_owner_only" on public.bills
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "payments_owner_only" on public.bill_payments
  for all to authenticated
  using (exists (select 1 from public.bills where bills.id = bill_payments.bill_id and bills.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.bills where bills.id = bill_payments.bill_id and bills.owner_id = (select auth.uid())));
