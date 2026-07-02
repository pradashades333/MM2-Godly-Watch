-- GodlyWatch accounts schema.
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  premium boolean not null default false,
  premium_since timestamptz,
  stripe_session_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  game text not null check (game in ('mm2', 'adoptme', 'growagarden')),
  item_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, game, item_id)
);

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  game text not null,
  item_id text not null,
  item_name text not null,
  old_value numeric,
  new_value numeric,
  move_at timestamptz not null,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, game, item_id, move_at)
);

create index if not exists favorites_game_item_idx on public.favorites (game, item_id);
create index if not exists notifications_user_move_idx on public.notifications (user_id, move_at desc);

-- All access goes through the server with the service-role key (which
-- bypasses RLS). Enabling RLS with no policies blocks direct client access.
alter table public.profiles enable row level security;
alter table public.favorites enable row level security;
alter table public.notifications enable row level security;
