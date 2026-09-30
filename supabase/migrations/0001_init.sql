-- FCS Staffing: posts, positions, officers, bid cycles, bids, and user roles.

create table grades (
  code text primary key,
  rank_order int not null unique,
  is_sfs boolean not null
);
insert into grades values
  ('04', 1, false), ('03', 2, false), ('02', 3, false), ('01', 4, false),
  ('OC', 5, true), ('MC', 6, true), ('CM', 7, true);

create table posts (
  id text primary key,
  city text not null,
  country text not null,
  region text not null,
  subregion text not null,
  lat double precision not null,
  lng double precision not null,
  post_type text not null check (post_type in ('E', 'C', 'M', 'H', 'D')),
  hardship_pct int not null default 0,
  language text,
  tour_years int not null default 3
);

create table positions (
  id text primary key,
  post_id text not null references posts (id) on delete cascade,
  grade text not null references grades (code),
  title text not null,
  specialty text,
  language_req text,
  bid_list_override text check (bid_list_override in ('add', 'remove')) -- admin edits to the bid list
);
create index positions_post_idx on positions (post_id);

create table officers (
  id text primary key,
  display_name text not null,
  grade text not null references grades (code),
  languages text[] not null default '{}',
  position_id text unique references positions (id) on delete set null,
  ted text check (ted ~ '^\d{4}-\d{2}$'), -- tour end date, YYYY-MM
  last_hardship_year int,
  training_language text, -- set while in language training before an onward assignment
  training_until text,
  onward_position_id text references positions (id) on delete set null,
  user_id uuid unique references auth.users (id) on delete set null
);

create table cycles (
  id text primary key,
  label text not null,
  is_active boolean not null default false,
  bidding_on boolean not null default false, -- bid list posted for officers to browse
  rules jsonb not null -- RuleConfig, edited on the Rules screen
);
create unique index one_active_cycle on cycles (is_active) where is_active;

-- Rounds decide who may bid and when. mode 'auto' follows the window; 'open'/'closed' override it.
create table rounds (
  id text primary key,
  cycle_id text not null references cycles (id) on delete cascade,
  name text not null,
  roles text[] not null default '{on-cycle,off-cycle}',
  grades text[] not null default '{}', -- empty = all grades
  include_officers text[] not null default '{}',
  exclude_officers text[] not null default '{}',
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  mode text not null default 'auto' check (mode in ('auto', 'open', 'closed')),
  sort_order int not null default 0
);

-- Officers placed this cycle (decided in person; recorded here so later rounds skip them)
create table assignments (
  cycle_id text not null references cycles (id) on delete cascade,
  officer_id text not null references officers (id) on delete cascade,
  position_id text references positions (id) on delete set null,
  round_id text references rounds (id) on delete set null,
  primary key (cycle_id, officer_id)
);

create table bids (
  cycle_id text not null references cycles (id) on delete cascade,
  officer_id text not null references officers (id) on delete cascade,
  position_id text not null references positions (id) on delete cascade,
  rank int not null check (rank > 0),
  submitted_at timestamptz,
  primary key (cycle_id, officer_id, position_id)
);
create index bids_position_idx on bids (position_id);

create table profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'viewer' check (role in ('viewer', 'bidder', 'admin'))
);

-- Row-level security ---------------------------------------------------------
alter table grades enable row level security;
alter table posts enable row level security;
alter table positions enable row level security;
alter table officers enable row level security;
alter table cycles enable row level security;
alter table rounds enable row level security;
alter table assignments enable row level security;
alter table bids enable row level security;
alter table profiles enable row level security;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select role from public.profiles where user_id = (select auth.uid())), 'viewer')
$$;

create or replace function public.my_officer_id() returns text
language sql stable security definer set search_path = '' as $$
  select id from public.officers where user_id = (select auth.uid())
$$;

-- Everyone signed in can read the footprint
create policy read_grades on grades for select to authenticated using (true);
create policy read_posts on posts for select to authenticated using (true);
create policy read_positions on positions for select to authenticated using (true);
create policy read_officers on officers for select to authenticated using (true);
create policy read_cycles on cycles for select to authenticated using (true);
create policy read_rounds on rounds for select to authenticated using (true);
create policy read_assignments on assignments for select to authenticated using (true);
create policy read_own_profile on profiles for select to authenticated using (user_id = (select auth.uid()) or public.my_role() = 'admin');

-- Bids: bidders and admins see all bids (demand); viewers see none
create policy read_bids on bids for select to authenticated using (public.my_role() in ('bidder', 'admin'));
create policy write_own_bids on bids for all to authenticated
  using (officer_id = public.my_officer_id() and submitted_at is null)
  with check (officer_id = public.my_officer_id());

-- Admins manage everything
create policy admin_posts on posts for all to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy admin_positions on positions for all to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy admin_officers on officers for all to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy admin_cycles on cycles for all to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy admin_rounds on rounds for all to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy admin_assignments on assignments for all to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy admin_bids on bids for all to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy admin_profiles on profiles for all to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
