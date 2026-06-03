-- Extensions
create extension if not exists pgcrypto;

-- Players
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  pseudo text not null unique,
  secret_code_hash text not null,
  created_at timestamptz not null default now(),
  constraint players_pseudo_format check (pseudo ~ '^[a-zA-Z0-9_\- ]{3,20}$')
);

-- Events
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  order_index int not null unique,
  created_at timestamptz not null default now(),
  constraint events_order_range check (order_index between 1 and 5)
);

-- Matches
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  player_a_id uuid not null references public.players(id) on delete cascade,
  player_b_id uuid not null references public.players(id) on delete cascade,
  winner_id uuid references public.players(id) on delete set null,
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint matches_players_distinct check (player_a_id <> player_b_id),
  constraint matches_winner_is_player check (winner_id is null or winner_id in (player_a_id, player_b_id))
);

-- Scores (append-only points history)
create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  points int not null,
  created_at timestamptz not null default now(),
  constraint scores_points_range check (points between -99 and 99)
);

-- Beer pong state persistence (draw + bracket choices)
create table if not exists public.beer_pong_state (
  event_id uuid primary key references public.events(id) on delete cascade,
  draw_player_ids uuid[] not null default '{}',
  semi1_winner_key text,
  semi2_winner_key text,
  updated_at timestamptz not null default now(),
  constraint beer_pong_state_draw_size check (array_length(draw_player_ids, 1) is null or array_length(draw_player_ids, 1) = 12),
  constraint beer_pong_state_semi1_key check (semi1_winner_key is null or semi1_winner_key in ('A', 'B')),
  constraint beer_pong_state_semi2_key check (semi2_winner_key is null or semi2_winner_key in ('C', 'D'))
);

create index if not exists idx_matches_event_id on public.matches(event_id);
create index if not exists idx_scores_event_player on public.scores(event_id, player_id);

-- View: global ranking
create or replace view public.global_ranking as
select
  p.id as player_id,
  p.pseudo as pseudo,
  coalesce(sum(s.points), 0)::int as total_points
from public.players p
left join public.scores s on s.player_id = p.id
group by p.id, p.pseudo
order by total_points desc, p.pseudo asc;

-- Seed the 5 events once
insert into public.events (name, order_index)
values
  ('Beer Pong Géant', 1),
  ('Épreuve 2', 2),
  ('Épreuve 3', 3),
  ('Épreuve 4', 4),
  ('Épreuve 5', 5)
on conflict (order_index) do update set name = excluded.name;

-- Enable RLS
alter table public.players enable row level security;
alter table public.events enable row level security;
alter table public.matches enable row level security;
alter table public.scores enable row level security;
alter table public.beer_pong_state enable row level security;

-- Public read policies (classements et affichage public)
drop policy if exists players_public_select on public.players;
create policy players_public_select on public.players
for select
to anon, authenticated
using (true);

drop policy if exists events_public_select on public.events;
create policy events_public_select on public.events
for select
to anon, authenticated
using (true);

drop policy if exists matches_public_select on public.matches;
create policy matches_public_select on public.matches
for select
to anon, authenticated
using (true);

drop policy if exists scores_public_select on public.scores;
create policy scores_public_select on public.scores
for select
to anon, authenticated
using (true);

drop policy if exists beer_pong_state_public_select on public.beer_pong_state;
create policy beer_pong_state_public_select on public.beer_pong_state
for select
to anon, authenticated
using (true);

-- No direct writes for anon/authenticated users (writes via service role only).
