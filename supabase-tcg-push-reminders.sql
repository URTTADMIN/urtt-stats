create table if not exists public.tcg_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  subscription jsonb not null,
  timezone text not null default 'Europe/Paris',
  enabled boolean not null default true,
  last_sent_local_date date,
  last_attempt_local_date date,
  created_at timestamptz not null default now()
);

alter table public.tcg_push_subscriptions
  add column if not exists last_attempt_local_date date;

alter table public.tcg_push_subscriptions enable row level security;
revoke all on table public.tcg_push_subscriptions from anon, authenticated;
grant all on table public.tcg_push_subscriptions to service_role;
