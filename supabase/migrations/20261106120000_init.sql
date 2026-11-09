-- Початкова схема панелі виробництва.
-- Ролі: owner (власник), manager (менеджер), constructor (конструктор), worker (цех, монтаж).
-- Гроші бачать лише owner і manager. Новий акаунт неактивний, доки власник його не підтвердить.

-- ---------- Люди ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null default 'worker' check (role in ('owner', 'manager', 'constructor', 'worker')),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

-- Перший акаунт стає власником, усі наступні чекають на підтвердження.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  is_first boolean;
begin
  select not exists (select 1 from public.profiles) into is_first;
  insert into public.profiles (id, full_name, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when is_first then 'owner' else 'worker' end,
    is_first
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- security definer: інакше політики таблиці profiles викликали б самі себе.
create function public.is_active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select active from public.profiles where id = (select auth.uid())), false);
$$;

create function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select active and role = 'owner' from public.profiles where id = (select auth.uid())), false);
$$;

create function public.can_see_money() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select active and role in ('owner', 'manager') from public.profiles where id = (select auth.uid())), false);
$$;

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- Замовлення ----------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  client text not null default '',
  city text not null default '',
  designer text not null default '',
  stage text not null default 'zamir'
    check (stage in ('zamir', 'proekt', 'materialy', 'vyrobnytstvo', 'montazh', 'zdano')),
  status text not null default 'active' check (status in ('active', 'paused', 'done')),
  deadline date,
  note text not null default '',
  bazis_slug text unique, -- папка в E:\BazisAI\projects, ключ для повторного імпорту
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- Вироби об'єкта. Статуси такі самі, як у project.json BazisAI.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  sheet text not null default '',
  known text not null default '',
  status text not null default 'todo' check (status in ('todo', 'wip', 'json', 'checked')),
  file text not null default '',
  modules integer,
  panels integer,
  position integer not null default 0,
  unique (order_id, name)
);
create index order_items_order on public.order_items (order_id);

-- ---------- Задачі ----------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  note text not null default '',
  order_id uuid references public.orders (id) on delete set null,
  assignee_id uuid references public.profiles (id) on delete set null,
  due_date date,
  status text not null default 'todo' check (status in ('todo', 'wip', 'done')),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_due on public.tasks (due_date);
create index tasks_assignee on public.tasks (assignee_id);
create index tasks_order on public.tasks (order_id);
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();

-- ---------- Гроші ----------
-- Сума договору окремо від orders: замовлення бачать усі, гроші — ні.
create table public.order_finance (
  order_id uuid primary key references public.orders (id) on delete cascade,
  contract_amount numeric(12, 2) not null default 0 check (contract_amount >= 0),
  updated_at timestamptz not null default now()
);
create trigger order_finance_touch before update on public.order_finance
  for each row execute function public.touch_updated_at();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  amount numeric(12, 2) not null check (amount > 0),
  paid_on date not null default current_date,
  category text not null default '',
  note text not null default '',
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index payments_order on public.payments (order_id);

-- ---------- Закупівлі ----------
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  quantity numeric(12, 3),
  unit text not null default 'шт',
  supplier text not null default '',
  status text not null default 'need' check (status in ('need', 'ordered', 'delivered')),
  needed_by date,
  note text not null default '',
  source text not null default 'manual' check (source in ('manual', 'bazis')),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index purchases_order on public.purchases (order_id);
create trigger purchases_touch before update on public.purchases
  for each row execute function public.touch_updated_at();

-- ---------- Доступ ----------
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.tasks enable row level security;
alter table public.order_finance enable row level security;
alter table public.payments enable row level security;
alter table public.purchases enable row level security;

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, delete on public.profiles from authenticated;

-- Свій профіль видно завжди: так неактивна людина дізнається, що чекає на підтвердження.
create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_active_user());
create policy profiles_owner_update on public.profiles for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy orders_read on public.orders for select to authenticated
  using (public.is_active_user());
create policy orders_insert on public.orders for insert to authenticated
  with check (public.is_active_user());
create policy orders_update on public.orders for update to authenticated
  using (public.is_active_user()) with check (public.is_active_user());
create policy orders_delete on public.orders for delete to authenticated
  using (public.can_see_money());

create policy order_items_all on public.order_items for all to authenticated
  using (public.is_active_user()) with check (public.is_active_user());

create policy tasks_all on public.tasks for all to authenticated
  using (public.is_active_user()) with check (public.is_active_user());

create policy purchases_all on public.purchases for all to authenticated
  using (public.is_active_user()) with check (public.is_active_user());

create policy order_finance_all on public.order_finance for all to authenticated
  using (public.can_see_money()) with check (public.can_see_money());

create policy payments_all on public.payments for all to authenticated
  using (public.can_see_money()) with check (public.can_see_money());
