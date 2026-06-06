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
  constraint events_order_range check (order_index between 1 and 4)
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
  final_winner_key text,
  small_final_winner_key text,
  individual_state jsonb not null default '{}'::jsonb,
  individual_validated_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint beer_pong_state_draw_size check (array_length(draw_player_ids, 1) is null or array_length(draw_player_ids, 1) = 12),
  constraint beer_pong_state_semi1_key check (semi1_winner_key is null or semi1_winner_key in ('A', 'B')),
  constraint beer_pong_state_semi2_key check (semi2_winner_key is null or semi2_winner_key in ('C', 'D')),
  constraint beer_pong_state_final_key check (final_winner_key is null or final_winner_key in ('A', 'B', 'C', 'D')),
  constraint beer_pong_state_small_final_key check (small_final_winner_key is null or small_final_winner_key in ('A', 'B', 'C', 'D'))
);

-- Molkpute state (poule 6 équipes de 2, 15 matchs)
create table if not exists public.molkpute_state (
  event_id uuid primary key references public.events(id) on delete cascade,
  draw_player_ids uuid[] not null default '{}',
  matches jsonb not null default '[]'::jsonb,
  finalized_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint molkpute_state_draw_size check (array_length(draw_player_ids, 1) is null or array_length(draw_player_ids, 1) = 12)
);

alter table public.molkpute_state add column if not exists finalized_at timestamptz;

-- Fin de partie Molkpute : 1 ligne = 1 joueur qui a clos un match à 50 pts
create table if not exists public.molkpute_finishes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  match_id text not null,
  player_id uuid not null references public.players(id) on delete cascade,
  team_key text not null,
  created_at timestamptz not null default now(),
  constraint molkpute_finishes_team_key check (team_key in ('1', '2', '3', '4', '5', '6')),
  constraint molkpute_finishes_match_player_unique unique (event_id, match_id)
);

create index if not exists idx_molkpute_finishes_event_player on public.molkpute_finishes(event_id, player_id);

alter table public.molkpute_state enable row level security;
alter table public.molkpute_finishes enable row level security;

drop policy if exists molkpute_state_public_select on public.molkpute_state;
create policy molkpute_state_public_select on public.molkpute_state
for select
to anon, authenticated
using (true);

drop policy if exists molkpute_finishes_public_select on public.molkpute_finishes;
create policy molkpute_finishes_public_select on public.molkpute_finishes
for select
to anon, authenticated
using (true);

-- Golf débile : saisie des coups par joueur (3 parcours)
create table if not exists public.golf_debile_state (
  event_id uuid primary key references public.events(id) on delete cascade,
  finalized_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.golf_debile_submissions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  course_1_strokes int not null,
  course_2_strokes int not null,
  course_3_strokes int not null,
  total_strokes int not null,
  submitted_at timestamptz not null default now(),
  constraint golf_debile_submissions_player_unique unique (event_id, player_id),
  constraint golf_debile_strokes_range check (
    course_1_strokes between 1 and 99
    and course_2_strokes between 1 and 99
    and course_3_strokes between 1 and 99
    and total_strokes between 3 and 297
  )
);

create index if not exists idx_golf_debile_submissions_event on public.golf_debile_submissions(event_id);

alter table public.golf_debile_state enable row level security;
alter table public.golf_debile_submissions enable row level security;

drop policy if exists golf_debile_state_public_select on public.golf_debile_state;
create policy golf_debile_state_public_select on public.golf_debile_state
for select to anon, authenticated using (true);

drop policy if exists golf_debile_submissions_public_select on public.golf_debile_submissions;
create policy golf_debile_submissions_public_select on public.golf_debile_submissions
for select to anon, authenticated using (true);

-- 100% Débile : quiz synchronisé (14 questions, 30 s, élimination + indices / rattrapage / passe)
create table if not exists public.debile100_state (
  event_id uuid primary key references public.events(id) on delete cascade,
  questions jsonb not null default '[]'::jsonb,
  current_question int not null default 0,
  phase text not null default 'idle',
  question_started_at timestamptz,
  finalized_at timestamptz,
  constraint debile100_state_phase check (phase in ('idle', 'playing', 'revealed')),
  constraint debile100_state_question_range check (current_question between 0 and 14)
);

alter table public.debile100_state add column if not exists finalized_at timestamptz;

create table if not exists public.debile100_player_status (
  event_id uuid not null references public.events(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  status text not null default 'active',
  eliminated_at_question int,
  hint_used_at_question int,
  pass_used_at_question int,
  catchup_question_index int,
  skip_question_index int,
  primary key (event_id, player_id),
  constraint debile100_player_status_value check (status in ('active', 'eliminated'))
);

create table if not exists public.debile100_answers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  question_index int not null,
  choice_id text not null,
  created_at timestamptz not null default now(),
  constraint debile100_answers_unique unique (event_id, player_id, question_index),
  constraint debile100_answers_question_range check (question_index between 1 and 14)
);

-- Migration si tables créées avec l'ancienne limite à 10 questions
alter table public.debile100_state drop constraint if exists debile100_state_question_range;
alter table public.debile100_state add constraint debile100_state_question_range check (current_question between 0 and 14);

alter table public.debile100_answers drop constraint if exists debile100_answers_question_range;
alter table public.debile100_answers add constraint debile100_answers_question_range check (question_index between 1 and 14);

alter table public.debile100_player_status add column if not exists hint_used_at_question int;
alter table public.debile100_player_status add column if not exists pass_used_at_question int;
alter table public.debile100_player_status add column if not exists catchup_question_index int;
alter table public.debile100_player_status add column if not exists skip_question_index int;

create index if not exists idx_debile100_answers_event on public.debile100_answers(event_id, question_index);

alter table public.debile100_state enable row level security;
alter table public.debile100_player_status enable row level security;
alter table public.debile100_answers enable row level security;

drop policy if exists debile100_state_public_select on public.debile100_state;
create policy debile100_state_public_select on public.debile100_state
for select to anon, authenticated using (true);

drop policy if exists debile100_player_status_public_select on public.debile100_player_status;
create policy debile100_player_status_public_select on public.debile100_player_status
for select to anon, authenticated using (true);

drop policy if exists debile100_answers_public_select on public.debile100_answers;
create policy debile100_answers_public_select on public.debile100_answers
for select to anon, authenticated using (true);

-- Migration pour projet existant (sans recréer la table)
alter table public.beer_pong_state add column if not exists final_winner_key text;
alter table public.beer_pong_state add column if not exists small_final_winner_key text;
alter table public.beer_pong_state add column if not exists individual_state jsonb not null default '{}'::jsonb;
alter table public.beer_pong_state add column if not exists individual_validated_at timestamptz;

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

-- Code secret = pseudo (pour comptes déjà créés avec l'ancien système)
update public.players
set secret_code_hash = encode(digest(pseudo, 'sha256'), 'hex');

-- Migration : retirer Con Battant et passer 100% Débile en épreuve 4
alter table public.events drop constraint if exists events_order_range;
update public.events e
set order_index = sub.temp_order
from (
  select id, 10000 + row_number() over (order by order_index, created_at, id) as temp_order
  from public.events
) sub
where e.id = sub.id;
delete from public.events where name ilike '%con battant%';
delete from public.events a
using public.events b
where a.name = b.name and a.created_at > b.created_at;
update public.events e
set order_index = mapping.target_order
from (
  values
    ('Beer Pong Géant', 1),
    ('Molkpute', 2),
    ('Golf Débile', 3),
    ('100% Débile', 4)
) as mapping(name, target_order)
join (
  select distinct on (name) id, name
  from public.events
  order by name, created_at, id
) keeper on keeper.name = mapping.name
where e.id = keeper.id;
delete from public.events
where name not in ('Beer Pong Géant', 'Molkpute', 'Golf Débile', '100% Débile');
alter table public.events add constraint events_order_range check (order_index between 1 and 4);

-- Seed the 4 events once
insert into public.events (name, order_index)
values
  ('Beer Pong Géant', 1),
  ('Molkpute', 2),
  ('Golf Débile', 3),
  ('100% Débile', 4)
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
