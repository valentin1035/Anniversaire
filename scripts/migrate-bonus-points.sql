-- Bonus organisateur (+1 pt global hors épreuve)
alter table public.players add column if not exists bonus_points int not null default 0;
alter table public.players drop constraint if exists players_bonus_points_range;
alter table public.players add constraint players_bonus_points_range check (bonus_points between 0 and 999);

create or replace view public.global_ranking as
select
  p.id as player_id,
  p.pseudo as pseudo,
  (coalesce(sum(s.points), 0) + coalesce(p.bonus_points, 0))::int as total_points
from public.players p
left join public.scores s on s.player_id = p.id
group by p.id, p.pseudo, p.bonus_points
order by total_points desc, p.pseudo asc;
