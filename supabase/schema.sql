-- Execute este arquivo no SQL Editor do seu projeto Supabase.
-- Para um aplicativo com vários usuários, adicione autenticação e políticas RLS
-- ligadas a auth.uid() antes de publicar.

create table if not exists public.people (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  salary numeric(12,2) not null check (salary >= 0),
  pay_day smallint not null check (pay_day between 1 and 31),
  color text not null default '#7067cf' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.bills (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  value numeric(12,2) not null check (value >= 0),
  due_day smallint not null check (due_day between 1 and 31),
  type text not null check (char_length(trim(type)) between 1 and 60),
  category text not null default 'Outros' check (char_length(trim(category)) between 1 and 60),
  responsible uuid references public.people(id) on delete set null,
  installments smallint check (installments between 1 and 360),
  start_period text check (start_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  flow text not null default 'payable' check (flow in ('payable', 'receivable')),
  check ((installments is null) = (start_period is null)),
  created_at timestamptz not null default now()
);

-- Cada pessoa pode receber em mais de uma data no mês.
create table if not exists public.income_payments (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  value numeric(12,2) not null check (value > 0),
  pay_day smallint not null check (pay_day between 1 and 31),
  created_at timestamptz not null default now()
);

create table if not exists public.expense_categories (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  color text not null default '#7067cf' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table if not exists public.expense_types (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (owner_id, name)
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

-- Registra alterações nos lançamentos para auditoria do usuário.
create table if not exists public.audit_logs (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entity_id uuid not null,
  action text not null check (action = 'updated'),
  changes jsonb not null,
  created_at timestamptz not null default now()
);

-- Segurança: cada usuário autenticado só enxerga os próprios dados.
alter table public.people enable row level security;
alter table public.bills enable row level security;
alter table public.income_payments enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expense_types enable row level security;
alter table public.bill_payments enable row level security;
alter table public.audit_logs enable row level security;

-- Impede que o dono da tabela ignore as politicas por acidente e evita acesso
-- direto pelo papel anon. A service_role continua exclusiva para processos no servidor.
alter table public.people force row level security;
alter table public.bills force row level security;
alter table public.income_payments force row level security;
alter table public.expense_categories force row level security;
alter table public.expense_types force row level security;
alter table public.bill_payments force row level security;
alter table public.audit_logs force row level security;

revoke all on table public.people, public.bills, public.income_payments, public.expense_categories, public.expense_types, public.bill_payments, public.audit_logs from anon;
grant select, insert, update, delete on table public.people, public.bills, public.income_payments, public.expense_categories, public.expense_types, public.bill_payments, public.audit_logs to authenticated;

drop policy if exists "people_owner_only" on public.people;
drop policy if exists "bills_owner_only" on public.bills;
drop policy if exists "income_payments_owner_only" on public.income_payments;
drop policy if exists "expense_categories_owner_only" on public.expense_categories;
drop policy if exists "expense_types_owner_only" on public.expense_types;
drop policy if exists "payments_owner_only" on public.bill_payments;
drop policy if exists "audit_logs_owner_only" on public.audit_logs;

create policy "people_owner_only" on public.people
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "bills_owner_only" on public.bills
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and (responsible is null or exists (
      select 1 from public.people person
      where person.id = responsible and person.owner_id = (select auth.uid())
    ))
  );

create policy "income_payments_owner_only" on public.income_payments
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.people person
      where person.id = person_id and person.owner_id = (select auth.uid())
    )
  );

create policy "expense_categories_owner_only" on public.expense_categories
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "expense_types_owner_only" on public.expense_types
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "payments_owner_only" on public.bill_payments
  for all to authenticated
  using (exists (select 1 from public.bills where bills.id = bill_payments.bill_id and bills.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.bills where bills.id = bill_payments.bill_id and bills.owner_id = (select auth.uid())));

create policy "audit_logs_owner_only" on public.audit_logs
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Indices para as consultas filtradas pelas politicas RLS e pelos relacionamentos.
create index if not exists people_owner_id_idx on public.people(owner_id);
create index if not exists bills_owner_id_idx on public.bills(owner_id);
create index if not exists bills_responsible_idx on public.bills(responsible);
create index if not exists income_payments_owner_id_idx on public.income_payments(owner_id);
create index if not exists income_payments_person_id_idx on public.income_payments(person_id);
create index if not exists expense_categories_owner_id_idx on public.expense_categories(owner_id);
create index if not exists expense_types_owner_id_idx on public.expense_types(owner_id);
create index if not exists audit_logs_owner_created_at_idx on public.audit_logs(owner_id, created_at desc);
