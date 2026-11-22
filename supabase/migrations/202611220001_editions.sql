alter table public.participants drop constraint participants_user_id_key,
 add unique (competition_id,user_id), drop constraint participants_role_check,
 add check(role in ('player','scorer','admin'));

create policy "members see their editions" on public.competitions for select to authenticated
 using(exists(select from public.participants p where p.competition_id=competitions.id and p.active and p.user_id=auth.uid()));

create or replace function public.link_auth_user_to_participant() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 update public.participants set user_id=new.id where lower(email)=lower(new.email) and active;
 return new;
end $$;

create function public.create_edition(edition_name text, source_id uuid) returns uuid
language plpgsql set search_path='' as $$
declare edition uuid;
begin
 if not public.is_admin() or trim(edition_name)='' then raise exception 'Sin permiso o nombre vacío'; end if;
 insert into public.competitions(name,landing_mode) values(trim(edition_name),'predictions') returning id into edition;
 insert into public.participants(competition_id,display_name,email,user_id,role)
 select edition, display_name,email,user_id,case when role='admin' then 'player' else role end
 from public.participants where competition_id=source_id and active;
 return edition;
end $$;

create function public.can_score(edition uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select from public.participants where competition_id=edition and user_id=auth.uid() and active and role='scorer')
$$;
alter table public.actual_match_results alter column winner_team_id drop not null,
 add column home_score integer check(home_score>=0), add column away_score integer check(away_score>=0);
create policy "edition scorers" on public.actual_match_results for all to authenticated using(public.can_score(competition_id)) with check(public.can_score(competition_id) and exists(select from public.knockout_matches m where m.id=match_id and m.competition_id=actual_match_results.competition_id) and (winner_team_id is null or exists(select from public.teams t where t.id=winner_team_id and t.competition_id=actual_match_results.competition_id)));
create policy "edition scorers" on public.actual_group_results for all to authenticated using(public.can_score(competition_id)) with check(public.can_score(competition_id) and exists(select from public.group_teams g where g.group_id=actual_group_results.group_id and g.team_id=actual_group_results.team_id and g.competition_id=actual_group_results.competition_id));
create policy "edition scorers" on public.award_results for all to authenticated using(public.can_score(competition_id)) with check(public.can_score(competition_id) and (candidate_id is null or exists(select from public.award_candidates c where c.id=candidate_id and c.competition_id=award_results.competition_id)));

do $$
declare edition uuid; grp uuid; team uuid; n integer:=0; country text; code text;
begin
 insert into public.competitions(name,landing_mode,prediction_deadline) values ('Copa familiar de prueba','predictions',now()+interval '90 days') returning id into edition;
 insert into public.participants(competition_id,display_name,email,user_id,role)
 select edition,p.display_name,p.email,p.user_id,case when p.role='admin' then 'player' else p.role end from public.participants p join public.competitions c on c.id=p.competition_id where c.is_active and p.active;
 insert into public.groups(competition_id,name) values(edition,'Grupo A') returning id into grp;
 for country,code in select * from (values ('España','ES'),('Francia','FR'),('Portugal','PT'),('Alemania','DE')) t loop
 n:=n+1;
 insert into public.teams(competition_id,name,country_code) values(edition,country,code) returning id into team;
 insert into public.group_teams(competition_id,group_id,team_id,sort_order) values(edition,grp,team,n);
 end loop;
 insert into public.knockout_matches(competition_id,stage,slot_index,label,home_source,away_source)
 values(edition,'final',1,'Final',jsonb_build_object('type','group_position','groupId',grp,'position',1),jsonb_build_object('type','group_position','groupId',grp,'position',2));
 insert into public.award_candidates(competition_id,name,sort_order) values(edition,'Lamine Yamal',1),(edition,'Kylian Mbappé',2);
end $$;
