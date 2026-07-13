-- Run after the auth and wallet/RPC migrations. Supabase Anonymous Sign-Ins must be enabled.
alter table public.profiles add column if not exists is_guest boolean not null default false;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare guest boolean := coalesce(new.is_anonymous, false);
begin
  insert into public.profiles(id, display_name, balance, role, account_status, is_guest)
  values (new.id, case when guest then 'Guest Player' else coalesce(nullif(new.raw_user_meta_data->>'display_name',''), nullif(new.raw_user_meta_data->>'full_name',''), split_part(coalesce(new.email,'player'),'@',1)) end, 1000, 'player', 'active', guest)
  on conflict (id) do nothing;
  insert into public.wallet_accounts(user_id,balance) values(new.id,1000) on conflict(user_id) do nothing;
  insert into public.transactions(user_id,type,amount,label,reference) values(new.id,'signup_bonus',1000,case when guest then 'Guest welcome balance' else 'Welcome bonus' end,'signup:'||new.id::text) on conflict do nothing;
  return new;
end; $$;

create or replace function public.ensure_my_guest_profile()
returns void language plpgsql security definer set search_path=public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  insert into public.profiles(id,display_name,balance,role,account_status,is_guest)
  values(uid,'Guest Player',1000,'player','active',true) on conflict(id) do nothing;
  insert into public.wallet_accounts(user_id,balance) values(uid,1000) on conflict(user_id) do nothing;
  insert into public.transactions(user_id,type,amount,label,reference) values(uid,'signup_bonus',1000,'Guest welcome balance','signup:'||uid::text) on conflict do nothing;
end; $$;

revoke all on function public.ensure_my_guest_profile() from public;
grant execute on function public.ensure_my_guest_profile() to authenticated;

-- Retention: retain guests with activity or unsettled bets; a scheduled admin job may
-- remove only inactive guest accounts older than 90 days with no bets/transactions after signup.
