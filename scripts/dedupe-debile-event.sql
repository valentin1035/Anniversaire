-- Corriger le doublon "100% Débile" dans public.events
-- Exécuter EN ENTIER dans Supabase SQL Editor

begin;

-- Voir l'état actuel
select id, name, order_index, created_at
from public.events
where name ilike '%100%'
  and (name ilike '%débile%' or name ilike '%debile%')
order by created_at;

alter table public.events drop constraint if exists events_order_range;

-- Garde la plus ancienne, supprime l'autre (cascade sur scores / état liés)
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
set name = '100% Débile', order_index = 4
where name ilike '%100%'
  and (name ilike '%débile%' or name ilike '%debile%');

alter table public.events add constraint events_order_range check (order_index between 1 and 4);

commit;

select id, name, order_index from public.events order by order_index;
