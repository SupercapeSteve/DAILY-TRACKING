-- ============================================================================
--  DAILY TRACKER - UPDATE an existing database
-- ============================================================================
--  Run this when the app says your database needs an update.
--
--  Paste the whole file into: Supabase Dashboard -> SQL Editor -> New query
--  -> Run.
--
--  This is the safe one. It only ADDS things:
--    - it never drops a table
--    - it never deletes a row
--    - it is safe to run as many times as you like
--
--  (schema.sql is the other file. That one is for a BRAND NEW project and it
--  wipes everything first. Do not run schema.sql on a database you already
--  have data in.)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. "just for me" mode (added in v1.2.0)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists solo boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. per-account appearance settings (added in v1.3.0)
--    One jsonb column, so future look-and-feel options need no migration.
-- ---------------------------------------------------------------------------
create table if not exists public.appearance (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  prefs      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.appearance enable row level security;

-- Your own look, and only ever your own. No partner-facing policy exists.
drop policy if exists appearance_all_own on public.appearance;
create policy appearance_all_own on public.appearance
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.appearance from anon;

-- ---------------------------------------------------------------------------
-- 3. rebuild the privacy gate so it knows about solo mode
--    `solo` is checked first and on its own: while it is true, no partner read
--    can succeed no matter what links or switches exist. A missing profile row
--    coalesces to true and therefore denies, so the failure mode is closed.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 4. tell the API layer to notice the new columns straight away.
--
--    This is the actual cause of "Could not find the 'solo' column of
--    'profiles' in the schema cache". Supabase keeps a cached picture of your
--    tables; adding a column does not always refresh it immediately. This
--    line forces the refresh instead of waiting for it.
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- ============================================================================
--  Check it worked. Expect: solo | appearance_table_exists = true
-- ============================================================================
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'solo') = 1                         as solo_column_ok,
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'appearance') = 1
                                                            as appearance_table_ok,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'appearance') >= 1
                                                            as appearance_rls_ok;
