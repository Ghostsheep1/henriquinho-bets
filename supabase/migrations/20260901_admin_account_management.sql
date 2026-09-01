-- Admin account management. Run after the existing auth and wallet migrations.
-- Only an active administrator may change another account's role or status.
create or replace function public.admin_update_account(target_id uuid, next_role text, next_status text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  updated public.profiles;
begin
  if caller_id is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.profiles where id = caller_id and role = 'admin' and account_status = 'active') then
    raise exception 'Admin required';
  end if;
  if target_id = caller_id and (next_role <> 'admin' or next_status <> 'active') then
    raise exception 'Administrators cannot remove their own access';
  end if;
  if next_role not in ('player', 'admin') or next_status not in ('active', 'suspended', 'locked') then
    raise exception 'Invalid account update';
  end if;

  update public.profiles
  set role = next_role, account_status = next_status, updated_at = now()
  where id = target_id
  returning * into updated;

  if not found then raise exception 'Account not found'; end if;
  insert into public.admin_audit_log(actor_id, target_user_id, action, details)
  values (caller_id, target_id, 'update_account', jsonb_build_object('role', next_role, 'status', next_status));
  return updated;
end;
$$;

revoke all on function public.admin_update_account(uuid, text, text) from public;
grant execute on function public.admin_update_account(uuid, text, text) to authenticated;
