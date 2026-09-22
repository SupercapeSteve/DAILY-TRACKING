-- ============================================================================
--  DAILY TRACKER - database schema
--  Paste this whole file into: Supabase Dashboard -> SQL Editor -> New query
--  Then press RUN. Safe to run more than once.
-- ============================================================================
--
--  PRIVACY MODEL (read this part, it is the whole point)
--  ----------------------------------------------------
--  The app is a static website. The key it ships with is public by design.
--  That means the browser cannot be trusted, and NONE of the privacy rules
--  live in the app. They all live here, in Postgres Row Level Security.
--
--  Three independent gates must ALL pass before the partner sees a row:
--    1. an accepted link between the two accounts exists
--    2. sharing is not paused
--    3. that specific category is switched on
--  ...and then the row itself must not be flagged private.
--
--  The owner's journal is never shareable at all. There is no toggle for it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Clean slate (only drops this app's own objects)
-- ---------------------------------------------------------------------------
drop table if exists public.feedback        cascade;
drop table if exists public.goals           cascade;
drop table if exists public.journal_entries cascade;
drop table if exists public.day_logs        cascade;
drop table if exists public.entries         cascade;
drop table if exists public.weight_logs     cascade;
drop table if exists public.body_profile    cascade;
drop table if exists public.share_settings  cascade;
drop table if exists public.partner_links   cascade;
drop table if exists public.profiles        cascade;
drop function if exists public.can_view(uuid, text)   cascade;
drop function if exists public.redeem_invite(text)    cascade;
drop function if exists public.new_invite_code()      cascade;
drop function if exists public.partner_view_state()    cascade;

-- ---------------------------------------------------------------------------
-- 1. profiles - non-sensitive identity. Safe for a linked partner to read.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role         text not null default 'owner' check (role in ('owner','partner')),
  units        text not null default 'imperial' check (units in ('imperial','metric')),
  onboarded    boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. partner_links - connects the two accounts. Created by the owner.
-- ---------------------------------------------------------------------------
create or replace function public.new_invite_code()
returns text
language sql
volatile
as $fn$
  -- 8 chars, no 0/O/1/I so the code cannot be misread over a text message
  select string_agg(
           substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789',
                  floor(random() * 31)::int + 1, 1), '')
  from generate_series(1, 8);
$fn$;

create table public.partner_links (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  partner_id  uuid          references auth.users(id) on delete set null,
  invite_code text not null unique default public.new_invite_code(),
  status      text not null default 'pending' check (status in ('pending','accepted','revoked')),
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  constraint no_self_link check (partner_id is null or partner_id <> owner_id)
);
create unique index partner_links_one_per_owner on public.partner_links(owner_id);
create index partner_links_partner on public.partner_links(partner_id);

-- ---------------------------------------------------------------------------
-- 3. share_settings - the owner's control panel. Default is SHARE NOTHING.
--    A brand new account leaks nothing even if a partner links instantly.
-- ---------------------------------------------------------------------------
create table public.share_settings (
  owner_id        uuid primary key references auth.users(id) on delete cascade,
  share_food      boolean not null default false,
  share_workouts  boolean not null default false,
  share_tasks     boolean not null default false,
  share_day       boolean not null default false,
  share_body      boolean not null default false,
  share_goals     boolean not null default false,
  sharing_paused  boolean not null default false,
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. body_profile - the sensitive basics. Separate table so that "share body
--    stats" can be a real row-level rule instead of a column-level promise.
-- ---------------------------------------------------------------------------
create table public.body_profile (
  owner_id       uuid primary key references auth.users(id) on delete cascade,
  birthdate      date,
  height_cm      numeric(5,1),
  goal_weight_kg numeric(5,1),
  activity_level text check (activity_level in ('sedentary','light','moderate','active','very_active')),
  notes          text not null default '',
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. weight_logs - weight is a time series, not a single number
-- ---------------------------------------------------------------------------
create table public.weight_logs (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  log_date   date not null default current_date,
  weight_kg  numeric(5,1) not null check (weight_kg > 0 and weight_kg < 700),
  note       text not null default '',
  created_at timestamptz not null default now(),
  unique (owner_id, log_date)
);
create index weight_logs_owner_date on public.weight_logs(owner_id, log_date desc);

-- ---------------------------------------------------------------------------
-- 6. entries - food, workouts and tasks in ONE table.
--    One table means ONE set of security rules to get right instead of three.
-- ---------------------------------------------------------------------------
create table public.entries (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('food','workout','task')),
  entry_date   date not null default current_date,
  logged_at    timestamptz not null default now(),
  title        text not null,
  notes        text not null default '',
  is_private   boolean not null default false,

  -- food
  meal_type    text check (meal_type in ('breakfast','lunch','dinner','snack')),
  calories     integer check (calories is null or (calories >= 0 and calories < 20000)),
  protein_g    integer check (protein_g is null or (protein_g >= 0 and protein_g < 1000)),

  -- workout
  duration_min integer check (duration_min is null or (duration_min >= 0 and duration_min < 1440)),
  intensity    text check (intensity in ('easy','moderate','hard')),

  -- task
  category     text,

  created_at   timestamptz not null default now()
);
create index entries_owner_date  on public.entries(owner_id, entry_date desc);
create index entries_owner_kind  on public.entries(owner_id, kind, entry_date desc);

-- ---------------------------------------------------------------------------
-- 7. day_logs - one row per day: mood, energy, sleep, water, "how was today"
-- ---------------------------------------------------------------------------
create table public.day_logs (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  log_date    date not null default current_date,
  mood        smallint check (mood between 1 and 5),
  energy      smallint check (energy between 1 and 5),
  sleep_hours numeric(3,1) check (sleep_hours is null or (sleep_hours >= 0 and sleep_hours <= 24)),
  water_cups  smallint check (water_cups is null or (water_cups >= 0 and water_cups <= 40)),
  day_note    text not null default '',
  is_private  boolean not null default false,
  updated_at  timestamptz not null default now(),
  unique (owner_id, log_date)
);
create index day_logs_owner_date on public.day_logs(owner_id, log_date desc);

-- ---------------------------------------------------------------------------
-- 8. journal_entries - ALWAYS private. No sharing toggle exists for this.
--    Deliberately has no partner-facing policy at all.
-- ---------------------------------------------------------------------------
create table public.journal_entries (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  log_date   date not null default current_date,
  body       text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, log_date)
);
create index journal_owner_date on public.journal_entries(owner_id, log_date desc);

-- ---------------------------------------------------------------------------
-- 9. goals - targets the OWNER sets for herself. Only she can create them.
-- ---------------------------------------------------------------------------
create table public.goals (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  metric       text not null default 'custom'
               check (metric in ('workouts_per_week','workout_minutes_per_week',
                                 'tasks_per_week','water_per_day','protein_per_day',
                                 'calories_per_day','days_logged_per_week','custom')),
  target_value numeric(8,1),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index goals_owner on public.goals(owner_id, active);

-- ---------------------------------------------------------------------------
-- 10. feedback - notes from the partner. She can delete any of them.
-- ---------------------------------------------------------------------------
create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  author_id  uuid not null references auth.users(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  reaction   text check (reaction in ('heart','thumbsup','seen')),
  created_at timestamptz not null default now()
);
create index feedback_owner on public.feedback(owner_id, created_at desc);

-- ============================================================================
--  THE GATE
--  can_view(owner, category) is the single function every partner-facing
--  rule calls. If this function is right, the app is right.
--
--  It is SECURITY DEFINER on purpose: the partner must not be able to read
--  the settings table directly, but the rules still need to consult it.
--  It only ever returns true/false, never a row.
-- ============================================================================
create or replace function public.can_view(p_owner uuid, p_category text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select
    -- you can always see your own data
    p_owner = (select auth.uid())
    or exists (
      select 1
      from public.partner_links pl
      join public.share_settings ss on ss.owner_id = pl.owner_id
      where pl.owner_id       = p_owner
        and pl.partner_id     = (select auth.uid())
        and pl.status         = 'accepted'      -- gate 1: linked
        and ss.sharing_paused = false           -- gate 2: not paused
        and case p_category                     -- gate 3: this category is on
              when 'food'    then ss.share_food
              when 'workout' then ss.share_workouts
              when 'task'    then ss.share_tasks
              when 'day'     then ss.share_day
              when 'body'    then ss.share_body
              when 'goals'   then ss.share_goals
              else false                        -- unknown category -> denied
            end
    );
$fn$;

revoke all on function public.can_view(uuid, text) from public, anon;
grant execute on function public.can_view(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
--  redeem_invite - the partner types the owner's code once.
--  SECURITY DEFINER because the partner cannot see the link row until it
--  is his. Single use: a code that is already claimed will not work again.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_invite(p_code text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_me    uuid := (select auth.uid());
  v_owner uuid;
begin
  if v_me is null then
    raise exception 'You need to be signed in.';
  end if;

  update public.partner_links
     set partner_id  = v_me,
         status      = 'accepted',
         accepted_at = now()
   where upper(replace(invite_code, ' ', ''))
         = upper(replace(coalesce(p_code, ''), ' ', ''))
     and partner_id is null
     and status = 'pending'
     and owner_id <> v_me
  returning owner_id into v_owner;

  if v_owner is null then
    raise exception 'That code did not work. Check it and try again.';
  end if;

  update public.profiles set role = 'partner' where id = v_me;
  return v_owner;
end;
$fn$;

revoke all on function public.redeem_invite(text) from public, anon;
grant execute on function public.redeem_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
--  partner_view_state - tells the PARTNER which categories are switched on.
--
--  This is a deliberate, minimal disclosure and it exists to prevent a real
--  harm: without it his dashboard cannot tell "she turned meals off" apart
--  from "she ate nothing today", and he would draw a false conclusion about
--  her. It returns switch positions only - never a single row of her data.
-- ---------------------------------------------------------------------------
create or replace function public.partner_view_state()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select jsonb_build_object(
    'owner_id',   pl.owner_id,
    'owner_name', coalesce(p.display_name, ''),
    'paused',     coalesce(ss.sharing_paused, false),
    'food',       coalesce(ss.share_food,     false),
    'workouts',   coalesce(ss.share_workouts, false),
    'tasks',      coalesce(ss.share_tasks,    false),
    'day',        coalesce(ss.share_day,      false),
    'body',       coalesce(ss.share_body,     false),
    'goals',      coalesce(ss.share_goals,    false)
  )
  from public.partner_links pl
  left join public.share_settings ss on ss.owner_id = pl.owner_id
  left join public.profiles p   on p.id        = pl.owner_id
  where pl.partner_id = (select auth.uid())
    and pl.status = 'accepted'
  limit 1;
$fn$;

revoke all on function public.partner_view_state() from public, anon;
grant execute on function public.partner_view_state() to authenticated;

-- ============================================================================
--  ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles        enable row level security;
alter table public.partner_links   enable row level security;
alter table public.share_settings  enable row level security;
alter table public.body_profile    enable row level security;
alter table public.weight_logs     enable row level security;
alter table public.entries         enable row level security;
alter table public.day_logs        enable row level security;
alter table public.journal_entries enable row level security;
alter table public.goals           enable row level security;
alter table public.feedback        enable row level security;

-- Nobody who is not signed in gets anything, ever.
revoke all on all tables in schema public from anon;

-- --- profiles --------------------------------------------------------------
create policy profiles_select_self on public.profiles
  for select to authenticated using (id = (select auth.uid()));

-- a linked partner may read the other person's NAME only (this table holds
-- nothing sensitive - age/height/weight live in body_profile)
create policy profiles_select_linked on public.profiles
  for select to authenticated using (
    exists (
      select 1 from public.partner_links pl
      where pl.status = 'accepted'
        and (   (pl.owner_id = profiles.id and pl.partner_id = (select auth.uid()))
             or (pl.partner_id = profiles.id and pl.owner_id = (select auth.uid())) )
    )
  );

create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- --- partner_links ---------------------------------------------------------
create policy links_select_mine on public.partner_links
  for select to authenticated using (
    owner_id = (select auth.uid()) or partner_id = (select auth.uid())
  );
-- only the owner creates the link, and only for herself
create policy links_insert_owner on public.partner_links
  for insert to authenticated with check (
    owner_id = (select auth.uid()) and partner_id is null
  );
-- only the OWNER can change or revoke the link. The partner cannot re-link
-- himself, cannot un-revoke, and cannot delete it.
create policy links_update_owner on public.partner_links
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy links_delete_owner on public.partner_links
  for delete to authenticated using (owner_id = (select auth.uid()));

-- --- share_settings --------------------------------------------------------
-- ONLY the owner. The partner can never read or write these.
create policy share_all_owner on public.share_settings
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- --- body_profile ----------------------------------------------------------
create policy body_select on public.body_profile
  for select to authenticated using (public.can_view(owner_id, 'body'));
create policy body_insert_own on public.body_profile
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy body_update_own on public.body_profile
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy body_delete_own on public.body_profile
  for delete to authenticated using (owner_id = (select auth.uid()));

-- --- weight_logs -----------------------------------------------------------
create policy weight_select on public.weight_logs
  for select to authenticated using (public.can_view(owner_id, 'body'));
create policy weight_insert_own on public.weight_logs
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy weight_update_own on public.weight_logs
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy weight_delete_own on public.weight_logs
  for delete to authenticated using (owner_id = (select auth.uid()));

-- --- entries ---------------------------------------------------------------
create policy entries_select_own on public.entries
  for select to authenticated using (owner_id = (select auth.uid()));
-- the partner path: not flagged private AND this category is shared
create policy entries_select_shared on public.entries
  for select to authenticated using (
    is_private = false and public.can_view(owner_id, kind)
  );
create policy entries_insert_own on public.entries
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy entries_update_own on public.entries
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy entries_delete_own on public.entries
  for delete to authenticated using (owner_id = (select auth.uid()));

-- --- day_logs --------------------------------------------------------------
create policy day_select_own on public.day_logs
  for select to authenticated using (owner_id = (select auth.uid()));
create policy day_select_shared on public.day_logs
  for select to authenticated using (
    is_private = false and public.can_view(owner_id, 'day')
  );
create policy day_insert_own on public.day_logs
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy day_update_own on public.day_logs
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy day_delete_own on public.day_logs
  for delete to authenticated using (owner_id = (select auth.uid()));

-- --- journal_entries -------------------------------------------------------
-- Note there is exactly one policy and it has no partner branch.
-- This is not an oversight. The journal is hers alone.
create policy journal_all_own on public.journal_entries
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- --- goals -----------------------------------------------------------------
create policy goals_select on public.goals
  for select to authenticated using (public.can_view(owner_id, 'goals'));
create policy goals_insert_own on public.goals
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy goals_update_own on public.goals
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy goals_delete_own on public.goals
  for delete to authenticated using (owner_id = (select auth.uid()));

-- --- feedback --------------------------------------------------------------
-- she reads notes written to her; he reads notes he wrote
create policy feedback_select on public.feedback
  for select to authenticated using (
    owner_id = (select auth.uid()) or author_id = (select auth.uid())
  );
-- he may only write to someone he is actually linked to
create policy feedback_insert_partner on public.feedback
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.partner_links pl
      where pl.owner_id = feedback.owner_id
        and pl.partner_id = (select auth.uid())
        and pl.status = 'accepted'
    )
  );
-- she can react to a note
create policy feedback_update_owner on public.feedback
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
-- she can delete anything sent to her. He can unsend his own.
create policy feedback_delete on public.feedback
  for delete to authenticated using (
    owner_id = (select auth.uid()) or author_id = (select auth.uid())
  );

-- ============================================================================
--  Done. Every table below should say rls_enabled = true
-- ============================================================================
select tablename, rowsecurity as rls_enabled
from pg_tables where schemaname = 'public' order by tablename;
