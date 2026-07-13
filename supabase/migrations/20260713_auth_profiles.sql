-- Supabase Auth profile hardening. Safe to run against the existing schema.
alter table public.profiles add column if not exists role text not null default 'player';
alter table public.profiles add column if not exists account_status text not null default 'active';
alter table public.profiles add column if not exists level integer not null default 1;
alter table public.profiles add column if not exists date_of_birth date;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.transactions add column if not exists reference text;
create unique index if not exists transactions_user_reference_unique
  on public.transactions (user_id, reference) where reference is not null;

do $$ begin
  alter table public.profiles add constraint profiles_role_check check (role in ('player', 'admin'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_status_check check (account_status in ('active', 'suspended', 'locked'));
exception when duplicate_object then null; end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, role, account_status)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(coalesce(new.email, 'player'), '@', 1)
    ),
    'player',
    'active'
  )
  on conflict (id) do nothing;

  insert into public.transactions (user_id, type, amount, label, reference)
  values (new.id, 'signup_bonus', 1000, 'Welcome bonus', 'signup:' || new.id::text)
  on conflict do nothing;
  return new;
end; $$;

create or replace function public.complete_my_profile(next_name text, next_birth_date date, accepted_terms boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not accepted_terms then raise exception 'Terms must be accepted'; end if;
  if next_birth_date is null or next_birth_date > current_date - interval '18 years' then
    raise exception 'You must be at least 18 years old';
  end if;
  update public.profiles
  set display_name = coalesce(nullif(left(trim(next_name), 80), ''), display_name),
      date_of_birth = coalesce(date_of_birth, next_birth_date),
      terms_accepted_at = coalesce(terms_accepted_at, now()),
      updated_at = now()
  where id = auth.uid();
end; $$;

create or replace function public.update_my_display_name(next_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.profiles
  set display_name = left(trim(next_name), 80), updated_at = now()
  where id = auth.uid();
end; $$;

revoke all on function public.update_my_display_name(text) from public;
grant execute on function public.update_my_display_name(text) to authenticated;
revoke all on function public.complete_my_profile(text, date, boolean) from public;
grant execute on function public.complete_my_profile(text, date, boolean) to authenticated;

alter table public.profiles enable row level security;
drop policy if exists "profiles are self editable" on public.profiles;
drop policy if exists "profiles are self readable" on public.profiles;
create policy "profiles are self readable" on public.profiles for select using (auth.uid() = id);
-- No direct INSERT/UPDATE policy: role, balance, level, and status are never client writable.
