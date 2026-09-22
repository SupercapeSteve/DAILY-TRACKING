-- ============================================================================
--  Migration 001 - "just for me" (solo) mode
-- ============================================================================
--  ONLY run this if you already ran schema.sql before solo mode existed and
--  you have data you want to keep. On a fresh project just run schema.sql,
--  which already includes everything below.
--
--  Paste into: Supabase Dashboard -> SQL Editor -> New query -> Run.
--  Safe to run more than once. Touches no rows.
-- ============================================================================

-- 1. the flag itself. Existing accounts default to false, i.e. unchanged.
alter table public.profiles
  add column if not exists solo boolean not null default false;

-- 2. teach the gate about it.
--    `solo` is checked first and on its own, so while it is true no partner
--    read can succeed no matter what links or switches exist.
create or replace function public.can_view(p_owner uuid, p_category text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select
    p_owner = (select auth.uid())
    or (
      not coalesce(
            (select p.solo from public.profiles p where p.id = p_owner),
            true)
      and exists (
        select 1
        from public.partner_links pl
        join public.share_settings ss on ss.owner_id = pl.owner_id
        where pl.owner_id       = p_owner
          and pl.partner_id     = (select auth.uid())
          and pl.status         = 'accepted'
          and ss.sharing_paused = false
          and case p_category
                when 'food'    then ss.share_food
                when 'workout' then ss.share_workouts
                when 'task'    then ss.share_tasks
                when 'day'     then ss.share_day
                when 'body'    then ss.share_body
                when 'goals'   then ss.share_goals
                else false
              end
      )
    );
$fn$;

revoke all on function public.can_view(uuid, text) from public, anon;
grant execute on function public.can_view(uuid, text) to authenticated;

-- ============================================================================
--  Check it worked. Expect one row: solo | boolean | false
-- ============================================================================
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'solo';
