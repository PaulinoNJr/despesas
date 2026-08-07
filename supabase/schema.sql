-- Execute este arquivo no SQL Editor do seu projeto Supabase.
-- Para um aplicativo com vários usuários, adicione autenticação e políticas RLS
-- ligadas a auth.uid() antes de publicar.

create table if not exists public.people (
  id uuid primary key,
  name text not null,
  salary numeric(12,2) not null check (salary >= 0),
  pay_day smallint not null check (pay_day between 1 and 31),
  color text not null default '#7067cf',
  created_at timestamptz not null default now()
);

create table if not exists public.bills (
  id uuid primary key,
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

-- Habilite RLS e crie políticas adequadas quando houver autenticação.
