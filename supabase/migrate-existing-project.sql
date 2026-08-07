-- Use este arquivo APENAS se você já executou uma versão anterior do schema.
-- Ele atualiza as tabelas sem remover lançamentos existentes.

alter table public.people add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.bills add column if not exists owner_id uuid references auth.users(id) on delete cascade;

-- A tabela de pagamentos pode não existir em instalações anteriores.
create table if not exists public.bill_payments (
  bill_id uuid not null references public.bills(id) on delete cascade,
  period text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  status text not null default 'paid' check (status = 'paid'),
  paid_at timestamptz not null default now(),
  primary key (bill_id, period)
);

-- Registros antigos sem proprietário não serão compartilhados. O app passa a
-- gravar dados novos com owner_id automático, a partir da sessão autenticada.
alter table public.people alter column owner_id set default auth.uid();
alter table public.bills alter column owner_id set default auth.uid();

alter table public.people enable row level security;
alter table public.bills enable row level security;
alter table public.bill_payments enable row level security;

drop policy if exists "people_owner_only" on public.people;
drop policy if exists "bills_owner_only" on public.bills;
drop policy if exists "payments_owner_only" on public.bill_payments;

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
