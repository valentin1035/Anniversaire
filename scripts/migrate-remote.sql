-- Migration prod Supabase : 4 épreuves, colonnes finalized_at
-- Exécuter ce bloc EN ENTIER dans SQL Editor (une seule transaction)

begin;

alter table public.molkpute_state add column if not exists finalized_at timestamptz;
alter table public.debile100_state add column if not exists finalized_at timestamptz;

alter table public.events drop constraint if exists events_order_range;

-- Décaler chaque ligne vers un index temporaire unique (basé sur id, pas order_index + 10)
update public.events e
set order_index = sub.temp_order
from (
  select id, 10000 + row_number() over (order by order_index, created_at, id) as temp_order
  from public.events
) sub
where e.id = sub.id;

-- Supprimer Con Battant (nom exact ou variante)
delete from public.scores
where event_id in (
  select id from public.events where name ilike '%con battant%'
);
delete from public.events where name ilike '%con battant%';

-- Supprimer les doublons 100% Débile (noms proches : espaces, accents…)
with debile_duplicates as (
  select id,
         row_number() over (order by created_at asc, id asc) as rn
  from public.events
  where name ilike '%100%'
    and (name ilike '%débile%' or name ilike '%debile%')
)
delete from public.events
where id in (select id from debile_duplicates where rn > 1);

update public.events
set name = '100% Débile'
where name ilike '%100%'
  and (name ilike '%débile%' or name ilike '%debile%');

-- Supprimer les autres doublons de nom exact (garder la plus ancienne)
delete from public.events a
using public.events b
where a.name = b.name and a.created_at > b.created_at;

-- Réassigner les 4 épreuves (une seule ligne par nom)
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

-- Supprimer tout événement qui n'est pas une des 4 épreuves
delete from public.events
where name not in ('Beer Pong Géant', 'Molkpute', 'Golf Débile', '100% Débile');

alter table public.events add constraint events_order_range check (order_index between 1 and 4);

insert into public.events (name, order_index)
values
  ('Beer Pong Géant', 1),
  ('Molkpute', 2),
  ('Golf Débile', 3),
  ('100% Débile', 4)
on conflict (order_index) do update set name = excluded.name;

drop table if exists public.con_battant_submissions;
drop table if exists public.con_battant_state;

commit;

-- Vérification
select name, order_index from public.events order by order_index;
