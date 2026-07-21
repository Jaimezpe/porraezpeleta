create extension if not exists pgcrypto;

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  landing_mode text not null default 'winner' check (landing_mode in ('winner', 'predictions', 'live')),
  winner_name text not null default 'Jaime',
  prediction_deadline timestamptz,
  max_participants integer not null default 16 check (max_participants between 1 and 16),
  wildcard_count integer not null default 0 check (wildcard_count >= 0),
  scoring jsonb not null default '{"groupExact":2,"groupQualified":1,"round32":4,"round16":7,"quarterfinal":10,"semifinal":12,"thirdPlace":12,"champion":20,"goldenBoot":20}'::jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index competitions_one_active_idx on public.competitions (is_active) where is_active;

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete set null,
  display_name text not null check (char_length(trim(display_name)) between 1 and 60),
  email text not null,
  role text not null default 'player' check (role in ('player', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competition_id, email)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  name text not null,
  country_code text,
  flag_url text,
  created_at timestamptz not null default now(),
  unique (competition_id, name)
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  name text not null,
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  unique (competition_id, name)
);

create table public.group_teams (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  sort_order integer not null default 1,
  unique (group_id, team_id),
  unique (competition_id, team_id)
);

create table public.knockout_matches (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  stage text not null check (stage in ('round32', 'round16', 'quarterfinal', 'semifinal', 'third_place', 'final')),
  slot_index integer not null check (slot_index > 0),
  label text,
  match_date timestamptz,
  home_source jsonb not null default '{}'::jsonb,
  away_source jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (competition_id, stage, slot_index)
);

create table public.award_candidates (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  name text not null,
  team_id uuid references public.teams(id) on delete set null,
  photo_url text,
  sort_order integer not null default 1,
  unique (competition_id, name)
);

create table public.prediction_entries (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (competition_id, participant_id)
);

create table public.group_predictions (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  entry_id uuid not null references public.prediction_entries(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  position integer not null check (position between 1 and 3),
  team_id uuid not null references public.teams(id) on delete cascade,
  unique (entry_id, group_id, position),
  unique (entry_id, group_id, team_id)
);

create table public.knockout_predictions (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  entry_id uuid not null references public.prediction_entries(id) on delete cascade,
  match_id uuid not null references public.knockout_matches(id) on delete cascade,
  winner_team_id uuid not null references public.teams(id) on delete cascade,
  unique (entry_id, match_id)
);

create table public.award_predictions (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  entry_id uuid not null references public.prediction_entries(id) on delete cascade,
  candidate_id uuid references public.award_candidates(id) on delete set null,
  custom_name text,
  check (candidate_id is not null or nullif(trim(custom_name), '') is not null),
  unique (entry_id)
);

create table public.actual_group_results (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  position integer not null check (position between 1 and 3),
  team_id uuid not null references public.teams(id) on delete cascade,
  unique (competition_id, group_id, position),
  unique (competition_id, group_id, team_id)
);

create table public.actual_match_results (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  match_id uuid not null references public.knockout_matches(id) on delete cascade,
  winner_team_id uuid not null references public.teams(id) on delete cascade,
  unique (competition_id, match_id)
);

create table public.award_results (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  candidate_id uuid references public.award_candidates(id) on delete set null,
  custom_name text,
  updated_at timestamptz not null default now(),
  check (candidate_id is not null or nullif(trim(custom_name), '') is not null),
  unique (competition_id)
);

create table public.login_requests (
  id bigint generated by default as identity primary key,
  participant_id uuid not null references public.participants(id) on delete cascade,
  requested_at timestamptz not null default now()
);

create index login_requests_participant_time_idx on public.login_requests (participant_id, requested_at desc);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.participants
    where user_id = auth.uid() and role = 'admin' and active
  );
$$;

create or replace function public.owns_participant(target_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.participants
    where id = target_participant_id and user_id = auth.uid() and active
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger competitions_updated_at before update on public.competitions
for each row execute function public.set_updated_at();
create trigger participants_updated_at before update on public.participants
for each row execute function public.set_updated_at();

create or replace function public.enforce_participant_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  allowed_count integer;
  current_count integer;
begin
  if not new.active then return new; end if;
  select max_participants into allowed_count from public.competitions where id = new.competition_id;
  select count(*) into current_count from public.participants
    where competition_id = new.competition_id and active and id <> new.id;
  if current_count >= allowed_count then
    raise exception 'Se ha alcanzado el maximo de participantes (%)', allowed_count;
  end if;
  return new;
end;
$$;

create trigger participants_limit before insert or update of active, competition_id on public.participants
for each row execute function public.enforce_participant_limit();

create or replace function public.link_auth_user_to_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.participants
    set user_id = new.id, updated_at = now()
    where lower(email) = lower(new.email)
      and active
      and competition_id = (select id from public.competitions where is_active limit 1);
  return new;
end;
$$;

create trigger auth_user_created after insert on auth.users
for each row execute function public.link_auth_user_to_participant();

create or replace view public.public_participants
with (security_invoker = false)
as
select id, competition_id, display_name
from public.participants
where active;

grant select on public.public_participants to anon, authenticated;

alter table public.competitions enable row level security;
alter table public.participants enable row level security;
alter table public.teams enable row level security;
alter table public.groups enable row level security;
alter table public.group_teams enable row level security;
alter table public.knockout_matches enable row level security;
alter table public.award_candidates enable row level security;
alter table public.prediction_entries enable row level security;
alter table public.group_predictions enable row level security;
alter table public.knockout_predictions enable row level security;
alter table public.award_predictions enable row level security;
alter table public.actual_group_results enable row level security;
alter table public.actual_match_results enable row level security;
alter table public.award_results enable row level security;
alter table public.login_requests enable row level security;

create policy "active competition is public" on public.competitions for select using (is_active or public.is_admin());
create policy "admins manage competitions" on public.competitions for all using (public.is_admin()) with check (public.is_admin());

create policy "participants read self or admin" on public.participants for select using (user_id = auth.uid() or public.is_admin());
create policy "admins manage participants" on public.participants for all using (public.is_admin()) with check (public.is_admin());

create policy "teams are public" on public.teams for select using (true);
create policy "admins manage teams" on public.teams for all using (public.is_admin()) with check (public.is_admin());
create policy "groups are public" on public.groups for select using (true);
create policy "admins manage groups" on public.groups for all using (public.is_admin()) with check (public.is_admin());
create policy "group teams are public" on public.group_teams for select using (true);
create policy "admins manage group teams" on public.group_teams for all using (public.is_admin()) with check (public.is_admin());
create policy "matches are public" on public.knockout_matches for select using (true);
create policy "admins manage matches" on public.knockout_matches for all using (public.is_admin()) with check (public.is_admin());
create policy "candidates are public" on public.award_candidates for select using (true);
create policy "admins manage candidates" on public.award_candidates for all using (public.is_admin()) with check (public.is_admin());

create policy "submitted or owned entries are readable" on public.prediction_entries for select using (
  status = 'submitted' or public.owns_participant(participant_id) or public.is_admin()
);
create policy "submitted or owned group picks are readable" on public.group_predictions for select using (
  exists (select 1 from public.prediction_entries e where e.id = entry_id and (e.status = 'submitted' or public.owns_participant(e.participant_id) or public.is_admin()))
);
create policy "submitted or owned knockout picks are readable" on public.knockout_predictions for select using (
  exists (select 1 from public.prediction_entries e where e.id = entry_id and (e.status = 'submitted' or public.owns_participant(e.participant_id) or public.is_admin()))
);
create policy "submitted or owned award picks are readable" on public.award_predictions for select using (
  exists (select 1 from public.prediction_entries e where e.id = entry_id and (e.status = 'submitted' or public.owns_participant(e.participant_id) or public.is_admin()))
);

create policy "actual groups are public" on public.actual_group_results for select using (true);
create policy "admins manage actual groups" on public.actual_group_results for all using (public.is_admin()) with check (public.is_admin());
create policy "actual matches are public" on public.actual_match_results for select using (true);
create policy "admins manage actual matches" on public.actual_match_results for all using (public.is_admin()) with check (public.is_admin());
create policy "award result is public" on public.award_results for select using (true);
create policy "admins manage award result" on public.award_results for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.save_prediction(
  p_participant_id uuid,
  p_group_picks jsonb,
  p_knockout_picks jsonb,
  p_award_pick jsonb,
  p_submit boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_competition public.competitions%rowtype;
  target_entry_id uuid;
  is_target_admin boolean := public.is_admin();
  expected_group_picks integer;
  expected_matches integer;
begin
  select c.* into target_competition
  from public.competitions c
  join public.participants p on p.competition_id = c.id
  where p.id = p_participant_id;

  if target_competition.id is null then raise exception 'Participante no encontrado'; end if;
  if not (public.owns_participant(p_participant_id) or is_target_admin) then raise exception 'Sin permiso'; end if;
  if not is_target_admin and target_competition.prediction_deadline is not null and now() > target_competition.prediction_deadline then
    raise exception 'El plazo para enviar la porra ha terminado';
  end if;

  if p_submit and not is_target_admin then
    select count(*) * 2 + target_competition.wildcard_count into expected_group_picks
      from public.groups where competition_id = target_competition.id;
    select count(*) into expected_matches from public.knockout_matches where competition_id = target_competition.id;
    if jsonb_array_length(coalesce(p_group_picks, '[]'::jsonb)) <> expected_group_picks then
      raise exception 'Completa todos los grupos y los terceros clasificados';
    end if;
    if jsonb_array_length(coalesce(p_knockout_picks, '[]'::jsonb)) <> expected_matches then
      raise exception 'Completa todo el cuadro eliminatorio';
    end if;
    if nullif(trim(coalesce(p_award_pick->>'candidate_id', p_award_pick->>'custom_name', '')), '') is null then
      raise exception 'Elige la Bota de Oro';
    end if;
  end if;

  insert into public.prediction_entries (competition_id, participant_id, status, submitted_at, updated_at)
  values (
    target_competition.id,
    p_participant_id,
    case when p_submit then 'submitted' else 'draft' end,
    case when p_submit then now() else null end,
    now()
  )
  on conflict (competition_id, participant_id) do update set
    status = case when p_submit then 'submitted' else prediction_entries.status end,
    submitted_at = case when p_submit then now() else prediction_entries.submitted_at end,
    updated_at = now()
  returning id into target_entry_id;

  delete from public.group_predictions where entry_id = target_entry_id;
  insert into public.group_predictions (competition_id, entry_id, group_id, position, team_id)
  select target_competition.id, target_entry_id, x.group_id, x.position, x.team_id
  from jsonb_to_recordset(coalesce(p_group_picks, '[]'::jsonb)) as x(group_id uuid, position integer, team_id uuid);

  delete from public.knockout_predictions where entry_id = target_entry_id;
  insert into public.knockout_predictions (competition_id, entry_id, match_id, winner_team_id)
  select target_competition.id, target_entry_id, x.match_id, x.winner_team_id
  from jsonb_to_recordset(coalesce(p_knockout_picks, '[]'::jsonb)) as x(match_id uuid, winner_team_id uuid);

  delete from public.award_predictions where entry_id = target_entry_id;
  if nullif(trim(coalesce(p_award_pick->>'candidate_id', p_award_pick->>'custom_name', '')), '') is not null then
    insert into public.award_predictions (competition_id, entry_id, candidate_id, custom_name)
    values (
      target_competition.id,
      target_entry_id,
      nullif(p_award_pick->>'candidate_id', '')::uuid,
      nullif(trim(p_award_pick->>'custom_name'), '')
    );
  end if;

  return target_entry_id;
end;
$$;

create or replace function public.delete_prediction(p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Sin permiso'; end if;
  delete from public.prediction_entries where participant_id = p_participant_id;
end;
$$;

grant execute on function public.save_prediction(uuid, jsonb, jsonb, jsonb, boolean) to authenticated;
grant execute on function public.delete_prediction(uuid) to authenticated;

insert into storage.buckets (id, name, public)
values ('porra-assets', 'porra-assets', true)
on conflict (id) do nothing;

create policy "porra assets are public" on storage.objects for select using (bucket_id = 'porra-assets');
create policy "admins upload porra assets" on storage.objects for insert with check (bucket_id = 'porra-assets' and public.is_admin());
create policy "admins update porra assets" on storage.objects for update using (bucket_id = 'porra-assets' and public.is_admin());
create policy "admins delete porra assets" on storage.objects for delete using (bucket_id = 'porra-assets' and public.is_admin());

insert into public.competitions (
  id, name, landing_mode, winner_name, max_participants, wildcard_count, is_active
) values (
  '8ad777f9-fbe5-4a7c-bb24-b94a51dce001',
  'Eurocopa 2028',
  'winner',
  'Jaime',
  16,
  8,
  true
);

insert into public.participants (
  competition_id, display_name, email, role
) values (
  '8ad777f9-fbe5-4a7c-bb24-b94a51dce001',
  'Jaime',
  'porra@jaimezpe.com',
  'admin'
);
