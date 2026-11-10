-- ============================================================
-- 轻账 · Supabase 云端表结构
-- 用法：Supabase 控制台 → SQL Editor → New query → 整段粘贴 → Run
-- 可重复执行（先 drop 再建，仅首次或重置时用）
-- ============================================================

-- ---------- 1. 表 ----------
drop table if exists public.txs cascade;
drop table if exists public.merchants cascade;
drop table if exists public.projects cascade;
drop table if exists public.accounts cascade;
drop table if exists public.categories cascade;
drop table if exists public.members cascade;
drop table if exists public.book_invites cascade;
drop table if exists public.book_members cascade;
drop table if exists public.books cascade;

create table public.books (
  id text primary key,
  name text not null,
  cover text default '📒',
  created_at bigint not null
);

-- 谁能看哪本账
create table public.book_members (
  book_id text not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member','viewer')),
  created_at timestamptz not null default now(),
  primary key (book_id, user_id)
);

-- 邀请码（6 位，24 小时有效）
create table public.book_invites (
  code text primary key,
  book_id text not null references public.books(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

create table public.members (
  id text primary key,
  book_id text not null references public.books(id) on delete cascade,
  name text not null,
  phone text,
  role text default 'MEMBER',
  status text default 'JOINED',
  remark text,
  is_hidden smallint default 0,
  sort bigint default 0,
  updated_at timestamptz not null default now()
);

create table public.categories (
  id text primary key,
  book_id text not null references public.books(id) on delete cascade,
  parent_id text,
  name text not null,
  icon text default '🏷️',
  type text not null check (type in ('EXPENSE','INCOME')),
  sort bigint default 0,
  is_hidden smallint default 0,
  updated_at timestamptz not null default now()
);

create table public.accounts (
  id text primary key,
  book_id text not null references public.books(id) on delete cascade,
  name text not null,
  icon text default '💳',
  type text default 'OTHER',
  is_liability smallint default 0,
  init_balance numeric default 0,
  include_in_assets smallint default 1,
  remark text,
  is_hidden smallint default 0,
  sort bigint default 0,
  updated_at timestamptz not null default now()
);

create table public.projects (
  id text primary key,
  book_id text not null references public.books(id) on delete cascade,
  name text not null,
  icon text default '📁',
  is_hidden smallint default 0,
  sort bigint default 0,
  updated_at timestamptz not null default now()
);

create table public.merchants (
  id text primary key,
  book_id text not null references public.books(id) on delete cascade,
  name text not null,
  icon text default '🏪',
  is_hidden smallint default 0,
  sort bigint default 0,
  updated_at timestamptz not null default now()
);

create table public.txs (
  id text primary key,
  book_id text not null references public.books(id) on delete cascade,
  type text not null check (type in ('EXPENSE','INCOME','TRANSFER','ADJUST')),
  amount numeric not null,
  category_id text,
  account_id text not null,
  to_account_id text,
  member_id text,
  project_id text,
  merchant_id text,
  occurred_at bigint not null,
  remark text,
  created_by text,
  created_at bigint not null,
  updated_by text,
  updated_at bigint,
  updated_ts timestamptz not null default now()
);

create index txs_book_time_idx on public.txs (book_id, occurred_at desc);
create index categories_book_idx on public.categories (book_id);
create index members_book_idx on public.members (book_id);

-- ---------- 2. 权限判断函数 ----------
create or replace function public.is_book_member(bid text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.book_members m
    where m.book_id = bid and m.user_id = auth.uid()
  );
$$;

create or replace function public.book_role(bid text)
returns text
language sql
security definer
set search_path = public
as $$
  select role from public.book_members m
  where m.book_id = bid and m.user_id = auth.uid()
  limit 1;
$$;

-- ---------- 3. RLS ----------
alter table public.books        enable row level security;
alter table public.book_members enable row level security;
alter table public.book_invites enable row level security;
alter table public.members      enable row level security;
alter table public.categories   enable row level security;
alter table public.accounts     enable row level security;
alter table public.projects     enable row level security;
alter table public.merchants    enable row level security;
alter table public.txs          enable row level security;

-- books：成员可读；任何登录用户可创建；owner 可改删
create policy books_read on public.books for select
  using (public.is_book_member(id));
create policy books_insert on public.books for insert
  to authenticated with check (true);
create policy books_update on public.books for update
  using (public.book_role(id) = 'owner');
create policy books_delete on public.books for delete
  using (public.book_role(id) = 'owner');

-- book_members：只能看到自己所在账本的成员行
create policy bm_read on public.book_members for select
  using (user_id = auth.uid() or public.is_book_member(book_id));
create policy bm_insert on public.book_members for insert
  to authenticated with check (user_id = auth.uid());
create policy bm_delete on public.book_members for delete
  using (public.book_role(book_id) = 'owner');

-- 业务表：成员可读写，只读成员只能读
do $$
declare t text;
begin
  foreach t in array array['members','categories','accounts','projects','merchants','txs'] loop
    execute format('create policy %I_read on public.%I for select using (public.is_book_member(book_id));', t, t);
    execute format('create policy %I_write on public.%I for insert to authenticated with check (public.book_role(book_id) in (''owner'',''member''));', t, t);
    execute format('create policy %I_update on public.%I for update using (public.book_role(book_id) in (''owner'',''member''));', t, t);
    execute format('create policy %I_delete on public.%I for delete using (public.book_role(book_id) in (''owner'',''member''));', t, t);
  end loop;
end $$;

-- ---------- 4. 邀请码 ----------
-- 生成邀请码（owner/member 可生成）
create or replace function public.create_invite(p_book text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare c text;
begin
  if public.book_role(p_book) not in ('owner','member') then
    raise exception '没有邀请权限';
  end if;
  loop
    c := upper(substr(md5(random()::text), 1, 6));
    exit when not exists (select 1 from public.book_invites where code = c and expires_at > now());
  end loop;
  insert into public.book_invites(code, book_id) values (c, p_book);
  return c;
end $$;

-- 用邀请码加入（返回 book_id）
create or replace function public.join_book(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare inv public.book_invites;
begin
  select * into inv from public.book_invites
   where code = upper(trim(p_code)) and expires_at > now();
  if inv.code is null then
    raise exception '邀请码无效或已过期';
  end if;
  insert into public.book_members(book_id, user_id, role)
  values (inv.book_id, auth.uid(), inv.role)
  on conflict (book_id, user_id) do nothing;
  return inv.book_id;
end $$;

-- 我参与的所有账本
create or replace function public.my_books()
returns table (book_id text, name text, role text)
language sql
security definer
set search_path = public
as $$
  select b.id, b.name, m.role
    from public.book_members m
    join public.books b on b.id = m.book_id
   where m.user_id = auth.uid()
   order by m.created_at;
$$;

grant execute on function public.is_book_member(text) to authenticated;
grant execute on function public.book_role(text) to authenticated;
grant execute on function public.create_invite(text) to authenticated;
grant execute on function public.join_book(text) to authenticated;
grant execute on function public.my_books() to authenticated;

-- ---------- 5. 实时推送 ----------
alter publication supabase_realtime add table public.txs;
alter publication supabase_realtime add table public.members;
alter publication supabase_realtime add table public.categories;
alter publication supabase_realtime add table public.accounts;
alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.merchants;
alter publication supabase_realtime add table public.books;

-- 完成。到 Authentication → Providers → Email：
--   · 关闭 "Confirm email"（家庭自用，省掉收验证邮件）
-- 到 Project Settings → API 复制 URL 与 anon public key，填到前端 .env
