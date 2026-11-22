create function public.publish_edition(edition uuid) returns void language plpgsql set search_path='' as $$
begin
 if not public.is_admin() or not exists(select from public.competitions where id=edition) then raise exception 'Edición no disponible'; end if;
 if not exists(select from public.participants p where p.competition_id=edition and p.user_id=auth.uid() and p.active) then raise exception 'Añade tu cuenta a la edición antes de publicarla'; end if;
 lock table public.competitions in share row exclusive mode;
 update public.competitions set is_active=false where is_active;
 update public.competitions set is_active=true where id=edition;
 update public.participants set role='admin' where competition_id=edition and user_id=auth.uid();
end $$;

create function public.match_participant_email() returns trigger language plpgsql security definer set search_path='' as $$
begin
 select id into new.user_id from auth.users where lower(email)=lower(new.email) limit 1;
 return new;
end $$;
create trigger match_participant_email before insert or update of email on public.participants
 for each row execute function public.match_participant_email();
