-- Pregame bookmaker snapshot storage. Safe to run repeatedly in Supabase SQL Editor.
create table if not exists public.odds_snapshots (
  id text primary key,
  matches jsonb not null,
  fetched_at timestamptz not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

do $$
begin
  alter table public.odds_snapshots
    add constraint odds_snapshots_matches_array check (jsonb_typeof(matches) = 'array');
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.odds_snapshots
    add constraint odds_snapshots_expiry_after_fetch check (expires_at > fetched_at);
exception when duplicate_object then null;
end $$;

create index if not exists odds_snapshots_expires_at_idx on public.odds_snapshots (expires_at);

alter table public.odds_snapshots enable row level security;

-- No client policies are intentionally created. The server uses the Supabase
-- service-role key, which bypasses RLS; browser anon/authenticated roles cannot read or write snapshots.
revoke all on table public.odds_snapshots from anon, authenticated;
