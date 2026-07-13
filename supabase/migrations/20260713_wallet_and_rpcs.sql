-- Run after schema.sql and 20260713_auth_profiles.sql. No service-role key required.
create table if not exists public.wallet_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance numeric(12,2) not null default 1000 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id),
  target_user_id uuid references public.profiles(id),
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.transactions add column if not exists reference text;
alter table public.bets add column if not exists idempotency_key text;
alter table public.bets add column if not exists market_source text not null default 'henriquinho-model';
alter table public.bets add column if not exists market_mode text not null default 'model-only';
alter table public.bets add column if not exists accepted_at timestamptz;
create unique index if not exists transactions_user_reference_unique on public.transactions(user_id, reference) where reference is not null;
create unique index if not exists bets_user_idempotency_unique on public.bets(user_id, idempotency_key) where idempotency_key is not null;

insert into public.wallet_accounts(user_id, balance)
select id, balance from public.profiles on conflict (user_id) do nothing;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name, balance, role, account_status)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name',''), nullif(new.raw_user_meta_data->>'full_name',''), split_part(coalesce(new.email,'player'),'@',1)), 1000, 'player', 'active')
  on conflict (id) do nothing;
  insert into public.wallet_accounts(user_id, balance) values(new.id, 1000) on conflict (user_id) do nothing;
  insert into public.transactions(user_id, type, amount, label, reference)
  values(new.id, 'signup_bonus', 1000, 'Welcome bonus', 'signup:' || new.id::text) on conflict do nothing;
  return new;
end; $$;

create or replace function public.place_model_bet(picks jsonb, stake_amount numeric, potential_amount numeric, request_key text)
returns public.bets language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); current_status text; current_balance numeric; created public.bets;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if request_key is null or length(request_key) < 8 then raise exception 'Invalid request key'; end if;
  select account_status into current_status from public.profiles where id = uid for update;
  if current_status <> 'active' then raise exception 'Account unavailable'; end if;
  if stake_amount <= 0 or potential_amount < stake_amount then raise exception 'Invalid stake or payout'; end if;
  if jsonb_typeof(picks) <> 'array' or jsonb_array_length(picks) = 0 then raise exception 'Invalid picks'; end if;
  if exists (select 1 from jsonb_array_elements(picks) p where coalesce(p->>'marketSource','henriquinho-model') <> 'henriquinho-model' or coalesce((p->>'recordedPrice')::numeric, 0) <= 1 or coalesce((p->>'startsAt')::timestamptz, now()) <= now()) then raise exception 'Market is unavailable'; end if;
  select balance into current_balance from public.wallet_accounts where user_id = uid for update;
  if current_balance < stake_amount then raise exception 'Insufficient balance'; end if;
  select * into created from public.bets where user_id=uid and idempotency_key=request_key;
  if found then return created; end if;
  update public.wallet_accounts set balance=balance-stake_amount, updated_at=now() where user_id=uid;
  update public.profiles set balance=balance-stake_amount, updated_at=now() where id=uid;
  insert into public.bets(user_id,picks,stake,potential_win,status,idempotency_key,market_source,market_mode,accepted_at)
  values(uid,picks,stake_amount,potential_amount,'open',request_key,'henriquinho-model','model-only',now()) returning * into created;
  insert into public.transactions(user_id,type,amount,label,reference) values(uid,'bet_stake',-stake_amount,'Model bet placed','bet:'||created.id::text);
  return created;
end; $$;

create or replace function public.settle_model_bet(bet_id uuid, won boolean)
returns public.bets language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); caller_role text; target public.bets; payout numeric := 0;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select role into caller_role from public.profiles where id=uid;
  if caller_role <> 'admin' then raise exception 'Admin required'; end if;
  select * into target from public.bets where id=bet_id for update;
  if target.status <> 'open' then return target; end if;
  payout := case when won then target.potential_win else 0 end;
  update public.bets set status=case when won then 'won' else 'lost' end, settled_at=now() where id=bet_id returning * into target;
  if payout > 0 then update public.wallet_accounts set balance=balance+payout,updated_at=now() where user_id=target.user_id; update public.profiles set balance=balance+payout,updated_at=now() where id=target.user_id; insert into public.transactions(user_id,type,amount,label,reference) values(target.user_id,'bet_win',payout,'Bet settlement','settle:'||target.id::text) on conflict do nothing; end if;
  insert into public.admin_audit_log(actor_id,target_user_id,action,details) values(uid,target.user_id,'settle_bet',jsonb_build_object('bet_id',bet_id,'won',won));
  return target;
end; $$;

create or replace function public.admin_list_accounts()
returns table(id uuid, display_name text, role text, account_status text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$ begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='admin' and account_status='active') then raise exception 'Admin required'; end if;
  return query select p.id,p.display_name,p.role,p.account_status,p.created_at from public.profiles p order by p.created_at desc limit 200;
end; $$;

alter table public.wallet_accounts enable row level security;
alter table public.admin_audit_log enable row level security;
drop policy if exists "bets are self insertable" on public.bets;
create policy "wallet is self readable" on public.wallet_accounts for select using(auth.uid()=user_id);
create policy "audit is admin readable" on public.admin_audit_log for select using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.account_status='active'));
revoke all on function public.place_model_bet(jsonb,numeric,numeric,text) from public;
revoke all on function public.settle_model_bet(uuid,boolean) from public;
revoke all on function public.admin_list_accounts() from public;
grant execute on function public.place_model_bet(jsonb,numeric,numeric,text) to authenticated;
grant execute on function public.settle_model_bet(uuid,boolean) to authenticated;
grant execute on function public.admin_list_accounts() to authenticated;
