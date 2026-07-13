create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  balance numeric(12, 2) not null default 1000,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  amount numeric(12, 2) not null,
  label text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id text primary key,
  sport text not null,
  league text not null,
  country text not null,
  home text not null,
  away text not null,
  starts_at timestamptz not null,
  status text not null,
  score text,
  odds jsonb not null,
  result jsonb
);

create table if not exists public.odds_snapshots (
  id text primary key,
  matches jsonb not null,
  fetched_at timestamptz not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  picks jsonb not null,
  stake numeric(12, 2) not null,
  potential_win numeric(12, 2) not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create table if not exists public.game_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game text not null,
  stake numeric(12, 2) not null,
  payout numeric(12, 2) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, balance)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)), 1000);

  insert into public.transactions (user_id, type, amount, label)
  values (new.id, 'signup_bonus', 1000, 'Welcome bonus');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.bets enable row level security;
alter table public.game_rounds enable row level security;
alter table public.matches enable row level security;
alter table public.odds_snapshots enable row level security;

create policy "profiles are self readable" on public.profiles for select using (auth.uid() = id);
create policy "profiles are self editable" on public.profiles for update using (auth.uid() = id);
create policy "transactions are self readable" on public.transactions for select using (auth.uid() = user_id);
create policy "bets are self readable" on public.bets for select using (auth.uid() = user_id);
create policy "bets are self insertable" on public.bets for insert with check (auth.uid() = user_id);
create policy "game rounds are self readable" on public.game_rounds for select using (auth.uid() = user_id);
create policy "game rounds are self insertable" on public.game_rounds for insert with check (auth.uid() = user_id);
create policy "matches are public readable" on public.matches for select using (true);
