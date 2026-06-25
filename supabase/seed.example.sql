-- 1. Create the mother/father users first in Supabase Auth.
-- 2. Replace emails and baby data below.
-- 3. Run this in Supabase SQL Editor after schema.sql.

with family as (
  insert into public.families (name)
  values ('Familia inicial')
  returning id
),
baby as (
  insert into public.babies (family_id, name, birth_date)
  select id, 'Bebé', '2026-06-24'
  from family
  returning family_id
)
insert into public.family_members (family_id, user_id, role)
select baby.family_id, users.id, 'parent'
from baby
join auth.users as users
  on users.email in ('madre@example.com', 'padre@example.com');
