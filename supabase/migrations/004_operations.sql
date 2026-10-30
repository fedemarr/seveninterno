-- Edition reuse, personal data editor, atomic roster swaps and real payment totals.
create or replace function public.admin_snapshot() returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb; eid uuid;begin
 if not public.is_admin() then raise exception 'UNAUTHORIZED';end if;
 select id into eid from public.events where active;
 result:=public.public_snapshot();
 return result||jsonb_build_object(
 'role',(select role from public.admin_users where id=auth.uid()),
 'payment_total',(select coalesce(sum(latest.amount),0) from public.registrations r join lateral (select p.amount from public.payment_records p where p.registration_id=r.id and p.status='PAGO_CONFIRMADO' order by p.created_at desc limit 1) latest on true where r.event_id=eid and r.payment_status='PAGO_CONFIRMADO'),
 'registrations',(select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('first_name',p.first_name,'last_name',p.last_name,'phone',p.phone,'level',v.level,'notes',coalesce(v.notes,''),'secondary_positions',coalesce(v.secondary_positions,'{}'),'available',coalesce(v.available,true),'assignment_locked',coalesce(v.assignment_locked,false),'excluded',coalesce(v.excluded,false),'together_with',coalesce(v.together_with,'{}'),'separate_from',coalesce(v.separate_from,'{}')) order by r.created_at desc),'[]') from public.registrations r join public.players p on p.id=r.player_id left join public.player_evaluations v on v.registration_id=r.id where r.event_id=eid),
 'competitions',(select coalesce(jsonb_agg(c),'[]') from public.competitions c where c.event_id=eid),
 'teams',(select coalesce(jsonb_agg(t),'[]') from public.teams t where t.event_id=eid),
 'members',(select coalesce(jsonb_agg(m),'[]') from public.team_members m join public.teams t on t.id=m.team_id where t.event_id=eid),
 'matches',(select coalesce(jsonb_agg(m order by m.starts_at),'[]') from public.matches m where m.event_id=eid),
 'plans',(select coalesce(jsonb_agg(p),'[]') from public.tournament_plans p where p.event_id=eid),
 'proposals',(select coalesce(jsonb_agg(x),'[]') from (select * from public.team_generation_runs where event_id=eid order by created_at desc limit 12)x),
 'audit',(select coalesce(jsonb_agg(x),'[]') from (select id,action,target_id,actor_id,created_at from public.audit_logs where event_id=eid order by created_at desc limit 100)x)
 );end$$;

create or replace function public.admin_apply(command jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare e public.events;actor_role text;op text;data jsonb;item jsonb;sub jsonb;rid uuid;tid uuid;comp uuid;pid uuid;cat public.categories;before_value jsonb;current_state text;begin
 perform set_config('request.jwt.claim.sub',command->>'actor_id',true);
 select role into actor_role from public.admin_users where id=auth.uid();
 if actor_role is null then raise exception 'UNAUTHORIZED';end if;
 op:=command->>'type';data:=command->'data';
 if actor_role='scorer' and op not in ('match.update','results.apply') then raise exception 'FORBIDDEN';end if;
 select * into e from public.events where active for update;
 if e.version<>(command->>'version')::int then raise exception 'STALE_VERSION';end if;
 before_value:=public.admin_snapshot()-'audit';
 if op='event.create' then
   if actor_role<>'owner' or e.state<>'TORNEO_FINALIZADO' then raise exception 'FINALIZE_PREVIOUS_EVENT';end if;
   update public.events set active=false where id=e.id;
   insert into public.events(name,edition) values(data->>'name',data->>'edition') returning id into e.id;
 elsif op='event.update' then
   current_state:=data->>'state';
   if current_state<>e.state and array_position(array['BORRADOR','INSCRIPCIONES_ABIERTAS','PREPARACION_EQUIPOS','EQUIPOS_PUBLICADOS','TORNEO_CONFIGURADO','TORNEO_EN_CURSO','TORNEO_FINALIZADO'],current_state)<>array_position(array['BORRADOR','INSCRIPCIONES_ABIERTAS','PREPARACION_EQUIPOS','EQUIPOS_PUBLICADOS','TORNEO_CONFIGURADO','TORNEO_EN_CURSO','TORNEO_FINALIZADO'],e.state)+1 then raise exception 'INVALID_TRANSITION';end if;
   if current_state='EQUIPOS_PUBLICADOS' and not exists(select 1 from public.teams where event_id=e.id and published) then raise exception 'PUBLISH_TEAMS_FIRST';end if;
   if current_state='TORNEO_CONFIGURADO' and not exists(select 1 from public.tournament_plans where event_id=e.id and published) then raise exception 'PUBLISH_TOURNAMENT_FIRST';end if;
   if current_state='TORNEO_FINALIZADO' and exists(select 1 from public.matches where event_id=e.id and status<>'finished') then raise exception 'UNFINISHED_MATCHES';end if;
   update public.events set name=data->>'name',edition=data->>'edition',state=current_state,registration_open=(data->>'registration_open')::boolean,late_registration=(data->>'late_registration')::boolean,amount=(data->>'amount')::numeric,alias=data->>'alias',holder=data->>'holder',bank_account=data->>'bank_account',payment_instructions=data->>'payment_instructions',event_date=nullif(data->>'event_date','')::date where id=e.id;
 elsif op='payment.update' then
   rid:=(data->>'id')::uuid;
   if data->>'status' not in ('PENDIENTE_PAGO','PAGO_EN_REVISION','PAGO_CONFIRMADO','PAGO_RECHAZADO') then raise exception 'PAYMENT_STATUS';end if;
   if data->>'status'<>'PAGO_CONFIRMADO' and exists(select 1 from public.team_members where registration_id=rid) then raise exception 'REMOVE_FROM_TEAM_FIRST';end if;
   insert into public.payment_records(registration_id,previous_status,status,amount,actor_id) select id,payment_status,data->>'status',e.amount,auth.uid() from public.registrations where id=rid and event_id=e.id;
   if not found then raise exception 'NOT_FOUND';end if;
   update public.registrations set payment_status=data->>'status',version=version+1 where id=rid and event_id=e.id;
 elsif op='player.create' then
   select * into cat from public.categories where id=(data->>'category_id')::uuid;
   if cat.id is null or (data->>'age')::int not between cat.min_age and cat.max_age then raise exception 'CATEGORY_AGE';end if;
   insert into public.players(first_name,last_name,phone,identity_key) values(data->>'first_name',data->>'last_name',data->>'phone',lower(trim(data->>'first_name')||'|'||trim(data->>'last_name')||'|'||regexp_replace(data->>'phone','[^0-9]','','g'))) on conflict(identity_key) do update set identity_key=excluded.identity_key returning id into pid;
   insert into public.registrations(event_id,player_id,age,category_id,position_id,guardian_name,guardian_phone,guardian_consent,consent,public_consent) values(e.id,pid,(data->>'age')::int,cat.id,(data->>'position_id')::uuid,data->>'guardian_name',data->>'guardian_phone',coalesce((data->>'guardian_consent')::boolean,false),(data->>'consent')::boolean,(data->>'public_consent')::boolean);
 elsif op='player.details' then
   rid:=(data->>'id')::uuid;item:=data->'input';
   if not exists(select 1 from public.registrations where id=rid and event_id=e.id) then raise exception 'NOT_FOUND';end if;
   select * into cat from public.categories where id=(item->>'category_id')::uuid;
   if cat.id is null or (item->>'age')::int not between cat.min_age and cat.max_age then raise exception 'CATEGORY_AGE';end if;
   update public.players set first_name=item->>'first_name',last_name=item->>'last_name',phone=item->>'phone',identity_key=lower(trim(item->>'first_name')||'|'||trim(item->>'last_name')||'|'||regexp_replace(item->>'phone','[^0-9]','','g')) where id=(select player_id from public.registrations where id=rid);
   update public.registrations set age=(item->>'age')::int,category_id=cat.id,position_id=(item->>'position_id')::uuid,guardian_name=item->>'guardian_name',guardian_phone=item->>'guardian_phone',guardian_consent=coalesce((item->>'guardian_consent')::boolean,false),public_consent=(item->>'public_consent')::boolean,consent=(item->>'consent')::boolean,version=version+1 where id=rid;
 elsif op='player.update' then
   rid:=(data->>'id')::uuid;
   if not exists(select 1 from public.registrations where id=rid and event_id=e.id) then raise exception 'NOT_FOUND';end if;
   if not (data->>'active')::boolean and exists(select 1 from public.team_members where registration_id=rid) then raise exception 'REMOVE_FROM_TEAM_FIRST';end if;
   update public.registrations set active=(data->>'active')::boolean,version=version+1 where id=rid;
   insert into public.player_evaluations(registration_id,level,notes,secondary_positions,available,assignment_locked,excluded,together_with,separate_from,updated_by)
   values(rid,nullif(data->>'level',''),data->>'notes',array(select jsonb_array_elements_text(data->'secondary_positions')),(data->>'available')::boolean,(data->>'assignment_locked')::boolean,(data->>'excluded')::boolean,array(select jsonb_array_elements_text(data->'together_with'))::uuid[],array(select jsonb_array_elements_text(data->'separate_from'))::uuid[],auth.uid())
   on conflict(registration_id) do update set level=excluded.level,notes=excluded.notes,secondary_positions=excluded.secondary_positions,available=excluded.available,assignment_locked=excluded.assignment_locked,excluded=excluded.excluded,together_with=excluded.together_with,separate_from=excluded.separate_from,updated_by=auth.uid(),updated_at=now();
 elsif op='competition.create' then
   if exists(select 1 from jsonb_array_elements_text(data->'category_ids') x where not exists(select 1 from public.categories where id=x::uuid)) then raise exception 'CATEGORY';end if;
   insert into public.competitions(event_id,name,category_ids,min_age,max_age,allow_mixed_ages,authorization_note) values(e.id,data->>'name',array(select jsonb_array_elements_text(data->'category_ids'))::uuid[],(data->>'min_age')::int,(data->>'max_age')::int,(data->>'allow_mixed_ages')::boolean,data->>'authorization_note');
 elsif op='proposal.save' then
   comp:=(data->>'competition_id')::uuid;
   if not exists(select 1 from public.competitions where id=comp and event_id=e.id) then raise exception 'COMPETITION';end if;
   insert into public.team_generation_runs(event_id,competition_id,proposal,created_by) values(e.id,comp,data->'proposal',auth.uid());
 elsif op='teams.confirm' then
   comp:=(data->>'competition_id')::uuid;
   if exists(select 1 from public.teams where competition_id=comp) then raise exception 'TEAMS_ALREADY_EXIST';end if;
   if e.state in ('TORNEO_EN_CURSO','TORNEO_FINALIZADO') then raise exception 'TOURNAMENT_STARTED';end if;
   for item in select * from jsonb_array_elements(data->'teams') loop
     insert into public.teams(event_id,competition_id,name) values(e.id,comp,item->>'name') returning id into tid;
     for sub in select * from jsonb_array_elements(item->'playerIds') loop
       rid:=(sub#>>'{}')::uuid;
       if not exists(select 1 from public.registrations r join public.competitions c on c.id=comp and c.event_id=e.id where r.id=rid and r.event_id=e.id and r.active and r.payment_status='PAGO_CONFIRMADO' and r.category_id=any(c.category_ids) and r.age between c.min_age and c.max_age) then raise exception 'INELIGIBLE_PLAYER';end if;
       insert into public.team_members(team_id,registration_id) values(tid,rid);
     end loop;
   end loop;
 elsif op='team.update' then
   update public.teams set name=data->>'name',color=data->>'color',version=version+1 where id=(data->>'id')::uuid and event_id=e.id;
   if not found then raise exception 'NOT_FOUND';end if;
 elsif op='member.swap' then
   rid:=(data->>'first_id')::uuid;pid:=(data->>'second_id')::uuid;
   select to_jsonb(m) into item from public.team_members m join public.teams t on t.id=m.team_id and t.event_id=e.id where m.registration_id=rid;
   select to_jsonb(m) into sub from public.team_members m join public.teams t on t.id=m.team_id and t.event_id=e.id where m.registration_id=pid;
   if item is null or sub is null or item->>'team_id'=sub->>'team_id' then raise exception 'INVALID_SWAP';end if;
   if ((item->>'locked')::boolean or (sub->>'locked')::boolean or exists(select 1 from public.player_evaluations where registration_id in (rid,pid) and assignment_locked)) and not (data->>'override_lock')::boolean then raise exception 'ASSIGNMENT_LOCKED';end if;
   delete from public.team_members where registration_id in (rid,pid);
   insert into public.team_members(team_id,registration_id,substitute,locked) values((sub->>'team_id')::uuid,rid,(item->>'substitute')::boolean,(item->>'locked')::boolean),((item->>'team_id')::uuid,pid,(sub->>'substitute')::boolean,(sub->>'locked')::boolean);
 elsif op='member.move' then
   rid:=(data->>'registration_id')::uuid;tid:=nullif(data->>'team_id','')::uuid;
   if exists(select 1 from public.team_members m join public.teams t on t.id=m.team_id where m.registration_id=rid and t.event_id=e.id and (m.locked or exists(select 1 from public.player_evaluations where registration_id=rid and assignment_locked))) and not coalesce((data->>'override_lock')::boolean,false) then raise exception 'ASSIGNMENT_LOCKED';end if;
   if tid is not null and not exists(select 1 from public.teams t join public.competitions c on c.id=t.competition_id join public.registrations r on r.id=rid where t.id=tid and t.event_id=e.id and r.event_id=e.id and r.active and r.payment_status='PAGO_CONFIRMADO' and r.category_id=any(c.category_ids) and r.age between c.min_age and c.max_age) then raise exception 'INELIGIBLE_PLAYER';end if;
   if not exists(select 1 from public.registrations where id=rid and event_id=e.id) then raise exception 'NOT_FOUND';end if;
   delete from public.team_members where registration_id=rid;
   if tid is not null then
     if coalesce((data->>'captain')::boolean,false) then update public.team_members set captain=false where team_id=tid;end if;
     insert into public.team_members(team_id,registration_id,captain,substitute,locked) values(tid,rid,coalesce((data->>'captain')::boolean,false),coalesce((data->>'substitute')::boolean,false),coalesce((data->>'locked')::boolean,false));
   end if;
 elsif op='teams.publish' then
   update public.teams set published=true,version=version+1 where event_id=e.id and competition_id=(data->>'competition_id')::uuid;
 elsif op='tournament.save' then
   comp:=(data->>'competition_id')::uuid;
   if e.state in ('TORNEO_EN_CURSO','TORNEO_FINALIZADO') or exists(select 1 from public.matches where competition_id=comp and status<>'scheduled') then raise exception 'TOURNAMENT_STARTED';end if;
   insert into public.tournament_plans(competition_id,event_id,plan) values(comp,e.id,data->'plan') on conflict(competition_id) do update set plan=excluded.plan,published=false,version=tournament_plans.version+1;
   delete from public.matches where competition_id=comp;
   for item in select * from jsonb_array_elements(data->'plan'->'matches') loop
     insert into public.matches(id,event_id,competition_id,number,phase,group_name,round,home_id,away_id,home_source,away_source,starts_at,court,duration)
     values(item->>'id',e.id,comp,(item->>'number')::int,item->>'phase',item->>'group_name',(item->>'round')::int,nullif(item->>'home_id','')::uuid,nullif(item->>'away_id','')::uuid,item->>'home_source',item->>'away_source',(item->>'starts_at')::timestamptz,(item->>'court')::int,(item->>'duration')::int);
   end loop;
 elsif op='tournament.publish' then
   comp:=(data->>'competition_id')::uuid;
   if exists(select 1 from public.teams where competition_id=comp and not published) then raise exception 'PUBLISH_TEAMS_FIRST';end if;
   update public.tournament_plans set published=true,version=version+1 where competition_id=comp and event_id=e.id;
   update public.matches set published=true,version=version+1 where competition_id=comp and event_id=e.id;
 elsif op='results.apply' then
   for item in select * from jsonb_array_elements(data->'matches') loop
     update public.matches set home_id=nullif(item->>'home_id','')::uuid,away_id=nullif(item->>'away_id','')::uuid,home_score=(item->>'home_score')::int,away_score=(item->>'away_score')::int,winner_id=nullif(item->>'winner_id','')::uuid,status=item->>'status',version=version+1 where id=item->>'id' and event_id=e.id;
   end loop;
 elsif op='match.update' then
   update public.matches set starts_at=(data->>'starts_at')::timestamptz,court=(data->>'court')::int,status=data->>'status',version=version+1 where id=data->>'id' and event_id=e.id;
   if not found then raise exception 'NOT_FOUND';end if;
 elsif op='category.update' then
   update public.categories set min_age=(data->>'min_age')::int,max_age=(data->>'max_age')::int where id=(data->>'id')::uuid;
 else raise exception 'UNKNOWN_COMMAND';end if;
 update public.events set version=version+1 where id=e.id;
 insert into public.audit_logs(event_id,actor_id,action,target_id,before_data,after_data) values(e.id,auth.uid(),op,coalesce(data->>'id',data->>'competition_id'),before_value,command->'data');
 return jsonb_build_object('success',true);
end$$;
