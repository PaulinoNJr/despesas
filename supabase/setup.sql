-- Execute este único arquivo no SQL Editor do Supabase.
-- Ele cria uma base nova ou atualiza uma base existente sem remover lançamentos.

create table if not exists public.people (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  salary numeric(12,2) not null default 0 check (salary >= 0),
  pay_day smallint not null default 1 check (pay_day between 1 and 31),
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
  is_credit_card boolean not null default false,
  card_name text check (char_length(trim(card_name)) between 1 and 80),
  check ((installments is null) = (start_period is null)),
  created_at timestamptz not null default now()
);

alter table public.people add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.bills add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.bills add column if not exists installments smallint;
alter table public.bills add column if not exists start_period text;
alter table public.bills add column if not exists flow text not null default 'payable';
alter table public.bills add column if not exists is_credit_card boolean not null default false;
alter table public.bills add column if not exists card_name text;
alter table public.bills drop constraint if exists bills_installments_check;
alter table public.bills drop constraint if exists bills_start_period_check;
alter table public.bills drop constraint if exists bills_installment_period_check;
alter table public.bills add constraint bills_installments_check check (installments between 1 and 360) not valid;
alter table public.bills add constraint bills_start_period_check check (start_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$') not valid;
alter table public.bills add constraint bills_installment_period_check check ((installments is null) = (start_period is null)) not valid;
alter table public.bills drop constraint if exists bills_flow_check;
alter table public.bills add constraint bills_flow_check check (flow in ('payable', 'receivable')) not valid;

-- Separa lançamentos de cartão já cadastrados pelo nome, sem alterar os demais.
update public.bills set is_credit_card = true where lower(name) like '%cartão%' or lower(name) like '%cartao%';
update public.bills set card_name = name where is_credit_card = true and card_name is null;

create table if not exists public.income_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  value numeric(12,2) not null check (value > 0),
  pay_day smallint not null check (pay_day between 1 and 31),
  created_at timestamptz not null default now()
);

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  color text not null default '#7067cf',
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table if not exists public.expense_types (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

-- A tabela de pagamentos pode não existir em instalações anteriores.
create table if not exists public.bill_payments (
  bill_id uuid not null references public.bills(id) on delete cascade,
  period text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  status text not null default 'paid' check (status = 'paid'),
  paid_at timestamptz not null default now(),
  primary key (bill_id, period)
);

create table if not exists public.audit_logs (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entity_id uuid not null,
  action text not null check (action = 'updated'),
  changes jsonb not null,
  created_at timestamptz not null default now()
);

-- Uma famÃ­lia representa o espaÃ§o financeiro compartilhado. Cada usuÃ¡rio
-- participa de apenas uma famÃ­lia, evitando que dados de grupos distintos se
-- misturem por engano.
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null check (email = lower(trim(email))),
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id),
  unique (user_id)
);

create table if not exists public.family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  email text not null check (email = lower(trim(email))),
  token uuid not null unique default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled')),
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create table if not exists public.credit_card_invoices (
  id uuid primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_name text not null check (char_length(trim(card_name)) between 1 and 80),
  invoice_key text not null check (char_length(trim(invoice_key)) between 8 and 160),
  statement_total numeric(12,2) not null,
  due_date date not null,
  source_file_name text,
  created_at timestamptz not null default now(),
  unique (family_id, invoice_key)
);

alter table public.bills add column if not exists card_invoice_id uuid references public.credit_card_invoices(id) on delete set null;
alter table public.bills drop constraint if exists bills_value_check;
alter table public.bills add constraint bills_value_check check (value >= 0 or is_credit_card) not valid;

alter table public.family_invites drop constraint if exists family_invites_family_id_email_status_key;
create unique index if not exists family_invites_one_pending_per_email_idx
  on public.family_invites (family_id, email) where status = 'pending';

-- Bases existentes passam a ter uma famÃ­lia de uma pessoa. O identificador da
-- famÃ­lia Ã© o mesmo UUID do primeiro titular, o que torna a migraÃ§Ã£o segura e
-- idempotente sem reescrever os lanÃ§amentos atuais.
insert into public.families (id)
select users.id from auth.users users
on conflict (id) do nothing;

insert into public.family_members (family_id, user_id, email)
select users.id, users.id, coalesce(lower(nullif(trim(users.email), '')), 'account-' || users.id::text || '@internal.local')
from auth.users users
on conflict (user_id) do nothing;

-- Novas contas recebem uma famÃ­lia prÃ³pria atÃ© aceitarem um convite. O
-- convite troca essa associaÃ§Ã£o somente quando a pessoa confirma o prÃ³prio e-mail.
create or replace function public.create_default_family_for_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.families (id) values (new.id) on conflict (id) do nothing;
  insert into public.family_members (family_id, user_id, email)
  values (new.id, new.id, coalesce(lower(nullif(trim(new.email), '')), 'account-' || new.id::text || '@internal.local'))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_default_family_for_new_user on auth.users;
create trigger create_default_family_for_new_user
  after insert on auth.users
  for each row execute procedure public.create_default_family_for_new_user();

-- A funÃ§Ã£o Ã© SECURITY DEFINER para que as policies possam consultar a relaÃ§Ã£o
-- familiar sem abrir leitura direta da tabela de membros.
create or replace function public.can_access_family_owner(target_owner uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.family_members viewer
    join public.family_members owner on owner.family_id = viewer.family_id
    where viewer.user_id = auth.uid() and owner.user_id = target_owner
  );
$$;

create or replace function public.current_family_id()
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select family_id from public.family_members where user_id = auth.uid();
$$;

-- Cria (ou renova) um convite. A confirmaÃ§Ã£o e a inclusÃ£o sÃ³ acontecem em
-- accept_family_invitation, depois que o destinatÃ¡rio abre o e-mail recebido.
create or replace function public.create_family_invitation(p_email text)
returns table(token uuid, email text, expires_at timestamptz)
language plpgsql
security definer set search_path = public
as $$
declare
  current_family uuid;
  normalized_email text := lower(trim(p_email));
begin
  if auth.uid() is null then raise exception 'AutenticaÃ§Ã£o necessÃ¡ria.'; end if;
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Informe um e-mail vÃ¡lido.';
  end if;
  if normalized_email = lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'Use o e-mail de outra pessoa da famÃ­lia.';
  end if;
  select family_id into current_family from public.family_members where user_id = auth.uid();
  if current_family is null then raise exception 'NÃ£o foi possÃ­vel identificar sua famÃ­lia.'; end if;
  if exists (
    select 1 from public.family_members member
    where member.email = normalized_email
      and (
        member.family_id <> member.user_id
        or exists (select 1 from public.people where owner_id = member.user_id)
        or exists (select 1 from public.bills where owner_id = member.user_id)
        or exists (select 1 from public.income_payments where owner_id = member.user_id)
      )
  ) then
    raise exception 'Este e-mail jÃ¡ participa de uma famÃ­lia.';
  end if;

  insert into public.family_invites (family_id, invited_by, email, token, status, expires_at)
  values (current_family, auth.uid(), normalized_email, gen_random_uuid(), 'pending', now() + interval '7 days')
  on conflict (family_id, email) where status = 'pending' do update
    set invited_by = excluded.invited_by, token = excluded.token, expires_at = excluded.expires_at,
        created_at = now(), accepted_at = null
  returning family_invites.token, family_invites.email, family_invites.expires_at
  into token, email, expires_at;
  return next;
end;
$$;

create or replace function public.get_family_invitation(p_token uuid)
returns table(email text, expires_at timestamptz)
language sql
stable
security definer set search_path = public
as $$
  select invitation.email, invitation.expires_at
  from public.family_invites invitation
  where invitation.token = p_token
    and invitation.status = 'pending'
    and invitation.expires_at > now()
    and invitation.email = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.cancel_family_invitation(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
  update public.family_invites invitation
  set status = 'cancelled'
  where invitation.id = p_id
    and invitation.status = 'pending'
    and public.can_access_family_owner(invitation.invited_by);
  if not found then raise exception 'Convite não encontrado ou sem permissão para cancelá-lo.'; end if;
end;
$$;

create or replace function public.accept_family_invitation(p_token uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  invitation public.family_invites%rowtype;
  current_family uuid;
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para aceitar o convite.'; end if;
  select * into invitation from public.family_invites
  where token = p_token and status = 'pending' and expires_at > now() and email = current_email
  for update;
  if not found then raise exception 'Este convite nÃ£o existe, expirou ou nÃ£o pertence a este e-mail.'; end if;

  select family_id into current_family from public.family_members where user_id = auth.uid();
  if current_family is not null and current_family <> invitation.family_id then
    -- Uma conta nova possui apenas a famÃ­lia vazia criada pelo trigger; ela pode
    -- ser substituÃ­da pelo espaÃ§o compartilhado. FamÃ­lias com dados exigem que a
    -- pessoa decida o que fazer com eles antes de migrar.
    if exists (select 1 from public.people where owner_id = auth.uid())
      or exists (select 1 from public.bills where owner_id = auth.uid())
      or exists (select 1 from public.income_payments where owner_id = auth.uid()) then
      raise exception 'Esta conta jÃ¡ possui dados em outra famÃ­lia.';
    end if;
    delete from public.family_members where user_id = auth.uid();
    delete from public.families where id = current_family;
  end if;

  insert into public.family_members (family_id, user_id, email)
  values (invitation.family_id, auth.uid(), current_email)
  on conflict (user_id) do update set family_id = excluded.family_id, email = excluded.email, joined_at = now();
  update public.family_invites set status = 'accepted', accepted_at = now() where id = invitation.id;
end;
$$;

-- Registros antigos sem proprietário não serão compartilhados. O app passa a
-- gravar dados novos com owner_id automático, a partir da sessão autenticada.
alter table public.people alter column owner_id set default auth.uid();
alter table public.bills alter column owner_id set default auth.uid();

-- Tipos e categorias agora sao cadastraveis pelo usuario, sem limitar aos dois
-- valores iniciais. NOT VALID preserva registros antigos; novos dados ja seguem a regra.
alter table public.bills drop constraint if exists bills_type_check;
alter table public.bills drop constraint if exists bills_category_check;
alter table public.bills add constraint bills_type_check check (char_length(trim(type)) between 1 and 60) not valid;
alter table public.bills add constraint bills_category_check check (char_length(trim(category)) between 1 and 60) not valid;
alter table public.people drop constraint if exists people_name_check;
alter table public.people drop constraint if exists people_color_check;
alter table public.bills drop constraint if exists bills_name_check;
alter table public.expense_categories drop constraint if exists expense_categories_name_check;
alter table public.expense_categories drop constraint if exists expense_categories_color_check;
alter table public.expense_types drop constraint if exists expense_types_name_check;
alter table public.people add constraint people_name_check check (char_length(trim(name)) between 1 and 80) not valid;
alter table public.people add constraint people_color_check check (color ~ '^#[0-9A-Fa-f]{6}$') not valid;
alter table public.bills add constraint bills_name_check check (char_length(trim(name)) between 1 and 120) not valid;
alter table public.expense_categories add constraint expense_categories_name_check check (char_length(trim(name)) between 1 and 60) not valid;
alter table public.expense_categories add constraint expense_categories_color_check check (color ~ '^#[0-9A-Fa-f]{6}$') not valid;
alter table public.expense_types add constraint expense_types_name_check check (char_length(trim(name)) between 1 and 60) not valid;

alter table public.people enable row level security;
alter table public.bills enable row level security;
alter table public.income_payments enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expense_types enable row level security;
alter table public.bill_payments enable row level security;
alter table public.audit_logs enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_invites enable row level security;
alter table public.credit_card_invoices enable row level security;

alter table public.people force row level security;
alter table public.bills force row level security;
alter table public.income_payments force row level security;
alter table public.expense_categories force row level security;
alter table public.expense_types force row level security;
alter table public.bill_payments force row level security;
alter table public.audit_logs force row level security;
alter table public.families force row level security;
alter table public.family_members force row level security;
alter table public.family_invites force row level security;
alter table public.credit_card_invoices force row level security;

revoke all on table public.people, public.bills, public.income_payments, public.expense_categories, public.expense_types, public.bill_payments, public.audit_logs from anon;
grant select, insert, update, delete on table public.people, public.bills, public.income_payments, public.expense_categories, public.expense_types, public.bill_payments, public.audit_logs to authenticated;
revoke all on table public.families, public.family_members, public.family_invites from anon;
grant select on table public.families, public.family_members, public.family_invites to authenticated;
revoke all on table public.credit_card_invoices from anon;
grant select, insert, delete on table public.credit_card_invoices to authenticated;

drop policy if exists "people_owner_only" on public.people;
drop policy if exists "bills_owner_only" on public.bills;
drop policy if exists "income_payments_owner_only" on public.income_payments;
drop policy if exists "expense_categories_owner_only" on public.expense_categories;
drop policy if exists "expense_types_owner_only" on public.expense_types;
drop policy if exists "payments_owner_only" on public.bill_payments;
drop policy if exists "audit_logs_owner_only" on public.audit_logs;
drop policy if exists "family_visible_to_members" on public.families;
drop policy if exists "family_members_visible_to_family" on public.family_members;
drop policy if exists "family_invites_visible_to_family" on public.family_invites;
drop policy if exists "credit_card_invoices_visible_to_family" on public.credit_card_invoices;

create policy "people_owner_only" on public.people
  for all to authenticated
  using (public.can_access_family_owner(owner_id))
  with check (public.can_access_family_owner(owner_id));

create policy "bills_owner_only" on public.bills
  for all to authenticated
  using (public.can_access_family_owner(owner_id))
  with check (
    public.can_access_family_owner(owner_id)
    and (responsible is null or exists (
      select 1 from public.people person
      where person.id = responsible and public.can_access_family_owner(person.owner_id)
    ))
  );

create policy "income_payments_owner_only" on public.income_payments
  for all to authenticated
  using (public.can_access_family_owner(owner_id))
  with check (
    public.can_access_family_owner(owner_id)
    and exists (
      select 1 from public.people person
      where person.id = person_id and public.can_access_family_owner(person.owner_id)
    )
  );

create policy "expense_categories_owner_only" on public.expense_categories
  for all to authenticated
  using (public.can_access_family_owner(owner_id))
  with check (public.can_access_family_owner(owner_id));

create policy "expense_types_owner_only" on public.expense_types
  for all to authenticated
  using (public.can_access_family_owner(owner_id))
  with check (public.can_access_family_owner(owner_id));

create policy "payments_owner_only" on public.bill_payments
  for all to authenticated
  using (exists (select 1 from public.bills where bills.id = bill_payments.bill_id and public.can_access_family_owner(bills.owner_id)))
  with check (exists (select 1 from public.bills where bills.id = bill_payments.bill_id and public.can_access_family_owner(bills.owner_id)));

create policy "audit_logs_owner_only" on public.audit_logs
  for all to authenticated
  using (public.can_access_family_owner(owner_id))
  with check (public.can_access_family_owner(owner_id));

create policy "family_visible_to_members" on public.families
  for select to authenticated
  using (exists (
    select 1 from public.family_members member
    where member.family_id = families.id and public.can_access_family_owner(member.user_id)
  ));

create policy "family_members_visible_to_family" on public.family_members
  for select to authenticated
  using (public.can_access_family_owner(family_members.user_id));

create policy "family_invites_visible_to_family" on public.family_invites
  for select to authenticated
  using (
    public.can_access_family_owner(family_invites.invited_by)
    or family_invites.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

create policy "credit_card_invoices_visible_to_family" on public.credit_card_invoices
  for all to authenticated
  using (family_id = public.current_family_id())
  with check (family_id = public.current_family_id() and public.can_access_family_owner(owner_id));

revoke all on function public.can_access_family_owner(uuid) from public;
revoke all on function public.current_family_id() from public;
revoke all on function public.create_family_invitation(text) from public;
revoke all on function public.get_family_invitation(uuid) from public;
revoke all on function public.cancel_family_invitation(uuid) from public;
revoke all on function public.accept_family_invitation(uuid) from public;
grant execute on function public.can_access_family_owner(uuid), public.current_family_id(), public.create_family_invitation(text), public.get_family_invitation(uuid), public.cancel_family_invitation(uuid), public.accept_family_invitation(uuid) to authenticated;

create index if not exists people_owner_id_idx on public.people(owner_id);
create index if not exists bills_owner_id_idx on public.bills(owner_id);
create index if not exists bills_responsible_idx on public.bills(responsible);
create index if not exists income_payments_owner_id_idx on public.income_payments(owner_id);
create index if not exists income_payments_person_id_idx on public.income_payments(person_id);
create index if not exists expense_categories_owner_id_idx on public.expense_categories(owner_id);
create index if not exists expense_types_owner_id_idx on public.expense_types(owner_id);
create index if not exists audit_logs_owner_created_at_idx on public.audit_logs(owner_id, created_at desc);
create index if not exists family_members_family_id_idx on public.family_members(family_id);
create index if not exists family_invites_family_id_idx on public.family_invites(family_id);
create index if not exists family_invites_email_idx on public.family_invites(email);
create index if not exists bills_card_invoice_id_idx on public.bills(card_invoice_id);
create index if not exists credit_card_invoices_family_id_idx on public.credit_card_invoices(family_id);
