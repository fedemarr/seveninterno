-- SEVEN INTERNO · Apply in a fresh Supabase project. All writes are transactional RPCs.
create extension if not exists pgcrypto;
create table public.admin_users(id uuid primary key references auth.users(id), role text not null check(role in ('owner','organizer','scorer')), created_at timestamptz not null default now());
create table public.events(id uuid primary key default gen_random_uuid(), name text not null default 'SEVEN INTERNO', edition text not null default 'ANTONIO “TONY” LEYES · 10° ANIVERSARIO', state text not null default 'BORRADOR' check(state in ('BORRADOR','INSCRIPCIONES_ABIERTAS','PREPARACION_EQUIPOS','EQUIPOS_PUBLICADOS','TORNEO_CONFIGURADO','TORNEO_EN_CURSO','TORNEO_FINALIZADO')), registration_open boolean not null default false, late_registration boolean not null default false, amount numeric(12,2) not null default 0 check(amount>=0), alias text not null default '', holder text not null default '', bank_account text not null default '', payment_instructions text not null default 'Transferí y enviá el comprobante por WhatsApp a Fede o Bauti. La participación queda pendiente hasta la confirmación.', event_date date, active boolean not null default true, version integer not null default 0, created_at timestamptz not null default now());
create unique index one_active_event on public.events(active) where active;
create table public.categories(id uuid primary key default gen_random_uuid(), name text unique not null, min_age int not null, max_age int not null, minor boolean not null, check(min_age<=max_age));
insert into public.categories(name,min_age,max_age,minor) values ('Plantel Superior',18,90,false),('Padres',18,90,false),('Veteranos',35,90,false),('M14',13,14,true),('M15',14,15,true),('M16',15,16,true),('M17',16,17,true),('M19',17,19,false);
create table public.positions(id uuid primary key default gen_random_uuid(), name text unique not null, "group" text not null check("group" in ('forward','back')));
insert into public.positions(name,"group") values ('Pilar izquierdo','forward'),('Pilar derecho','forward'),('Hooker','forward'),('Segunda línea','forward'),('Tercera línea / Ala','forward'),('Octavo','forward'),('Medio scrum','back'),('Apertura','back'),('Primer centro','back'),('Segundo centro','back'),('Wing','back'),('Fullback','back');
create table public.players(id uuid primary key default gen_random_uuid(), first_name text not null, last_name text not null, phone text not null, identity_key text unique not null, created_at timestamptz not null default now());
create table public.registrations(id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events, player_id uuid not null references public.players, age integer not null check(age between 13 and 90), category_id uuid not null references public.categories, position_id uuid not null references public.positions, guardian_name text, guardian_phone text, guardian_consent boolean not null default false, consent boolean not null check(consent), public_consent boolean not null default false, payment_status text not null default 'PENDIENTE_PAGO' check(payment_status in ('PENDIENTE_PAGO','PAGO_EN_REVISION','PAGO_CONFIRMADO','PAGO_RECHAZADO')), active boolean not null default true, version int not null default 0, created_at timestamptz not null default now(), unique(event_id,player_id), check(age>=18 or (length(guardian_name)>=3 and length(guardian_phone)>=8 and guardian_consent)));
create index registrations_event on public.registrations(event_id);
create index registrations_category on public.registrations(category_id);
create index registrations_position on public.registrations(position_id);
create index registrations_player on public.registrations(player_id);
create table public.player_evaluations(registration_id uuid primary key references public.registrations, level text check(level in ('A','B','C')), notes text not null default '', secondary_positions text[] not null default '{}', available boolean not null default true, assignment_locked boolean not null default false, excluded boolean not null default false, together_with uuid[] not null default '{}', separate_from uuid[] not null default '{}', updated_at timestamptz not null default now(), updated_by uuid references auth.users);
create table public.payment_records(id uuid primary key default gen_random_uuid(), registration_id uuid not null references public.registrations, previous_status text not null, status text not null, amount numeric not null, actor_id uuid references auth.users, created_at timestamptz not null default now());
create index payments_registration on public.payment_records(registration_id);
create table public.competitions(id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events, name text not null, category_ids uuid[] not null, min_age int not null default 18, max_age int not null default 90, allow_mixed_ages boolean not null default false, authorization_note text not null default '', version int not null default 0, check(min_age<=max_age), check(min_age>=18 or max_age<18 or (allow_mixed_ages and length(authorization_note)>=10)));
create index competitions_event on public.competitions(event_id);
create table public.teams(id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events, competition_id uuid not null references public.competitions, name text not null, color text not null default '#2566E8', published boolean not null default false, version int not null default 0);
create index teams_event on public.teams(event_id);
create index teams_competition on public.teams(competition_id);
create table public.team_members(id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams, registration_id uuid not null references public.registrations, captain boolean not null default false, substitute boolean not null default false, locked boolean not null default false, unique(registration_id), unique(team_id,registration_id));
create unique index one_captain on public.team_members(team_id) where captain;
create index members_team on public.team_members(team_id);
create table public.team_generation_runs(id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events, competition_id uuid not null references public.competitions, proposal jsonb not null, created_by uuid references auth.users, created_at timestamptz not null default now());
create table public.tournament_plans(competition_id uuid primary key references public.competitions, event_id uuid not null references public.events, plan jsonb not null, published boolean not null default false, version int not null default 0);
create table public.matches(id text primary key, event_id uuid not null references public.events, competition_id uuid not null references public.competitions, number int not null, phase text not null check(phase in ('group','gold','silver','milk')), group_name text, round int not null, home_id uuid references public.teams, away_id uuid references public.teams, home_source text, away_source text, starts_at timestamptz not null, court int not null check(court>0), duration int not null check(duration>0), status text not null default 'scheduled' check(status in ('scheduled','live','finished')), home_score int check(home_score>=0), away_score int check(away_score>=0), winner_id uuid references public.teams, published boolean not null default false, version int not null default 0, check(home_id is null or away_id is null or home_id<>away_id), check(status<>'finished' or (home_score is not null and away_score is not null)));
create index matches_event on public.matches(event_id);
create index matches_competition on public.matches(competition_id);
create index matches_home on public.matches(home_id);
create index matches_away on public.matches(away_id);
create table public.audit_logs(id uuid primary key default gen_random_uuid(), event_id uuid references public.events, actor_id uuid references auth.users, action text not null, target_id text, before_data jsonb, after_data jsonb, created_at timestamptz not null default now());
create index audit_event on public.audit_logs(event_id,created_at desc);
create table public.rate_limits(key text primary key, count int not null default 1, window_start timestamptz not null default now());

create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.admin_users where id=auth.uid())$$;
-- No direct browser writes, even for administrators. Audited RPCs own mutations.
do $$declare t text; begin foreach t in array array['admin_users','events','categories','positions','players','registrations','player_evaluations','payment_records','competitions','teams','team_members','team_generation_runs','tournament_plans','matches','audit_logs','rate_limits'] loop execute format('alter table public.%I enable row level security',t); execute format('create policy admin_read on public.%I for select to authenticated using (public.is_admin())',t); end loop;end$$;
revoke all on all tables in schema public from anon;
revoke insert,update,delete on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;

create function public.public_snapshot() returns jsonb language sql stable security definer set search_path=public as $$
select jsonb_build_object(
 'event',(select to_jsonb(e)-'active'-'created_at' from public.events e where active limit 1),
 'categories',(select coalesce(jsonb_agg(c order by min_age,name),'[]') from public.categories c),
 'positions',(select coalesce(jsonb_agg(p order by "group" desc,name),'[]') from public.positions p),
 'competitions',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name)),'[]') from public.competitions c join public.events e on e.id=c.event_id and e.active),
 'teams',(select coalesce(jsonb_agg(t),'[]') from public.teams t join public.events e on e.id=t.event_id and e.active where t.published),
 'members',(select coalesce(jsonb_agg(jsonb_build_object('team_id',t.id,'name',p.first_name||' '||left(p.last_name,1)||'.','captain',m.captain,'substitute',m.substitute)),'[]') from public.team_members m join public.teams t on t.id=m.team_id join public.events e on e.id=t.event_id and e.active join public.registrations r on r.id=m.registration_id join public.players p on p.id=r.player_id where t.published and r.active and r.age>=18 and r.public_consent),
 'matches',(select coalesce(jsonb_agg(m order by m.starts_at),'[]') from public.matches m join public.events e on e.id=m.event_id and e.active where m.published),
 'plans',(select coalesce(jsonb_agg(jsonb_build_object('competition_id',p.competition_id,'plan',p.plan)),'[]') from public.tournament_plans p join public.events e on e.id=p.event_id and e.active where p.published)
)$$;

create function public.admin_snapshot() returns jsonb language plpgsql stable security definer set search_path=public as $$
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

create function public.register_player(payload jsonb, ip_hash text) returns jsonb language plpgsql security definer set search_path=public as $$
declare e public.events;cat public.categories;pid uuid;rid uuid;identity text;hits int;begin
 select * into e from public.events where active for update;
 if e.id is null or not e.registration_open or (e.state not in ('INSCRIPCIONES_ABIERTAS','PREPARACION_EQUIPOS') and not e.late_registration) or e.state='TORNEO_FINALIZADO' then raise exception 'REGISTRATION_CLOSED';end if;
 insert into public.rate_limits(key) values(ip_hash) on conflict(key) do update set count=case when rate_limits.window_start<now()-interval '15 minutes' then 1 else rate_limits.count+1 end,window_start=case when rate_limits.window_start<now()-interval '15 minutes' then now() else rate_limits.window_start end returning count into hits;
 if hits>8 then return jsonb_build_object('error','RATE_LIMIT');end if;
 select * into cat from public.categories where id=(payload->>'category_id')::uuid;
 if cat.id is null or (payload->>'age')::int not between cat.min_age and cat.max_age then raise exception 'CATEGORY_AGE';end if;
 if not exists(select 1 from public.positions where id=(payload->>'position_id')::uuid) then raise exception 'POSITION';end if;
 if length(trim(payload->>'first_name')) not between 2 and 60 or length(trim(payload->>'last_name')) not between 2 and 60 or not (payload->>'consent')::boolean then raise exception 'VALIDATION';end if;
 identity:=lower(trim(payload->>'first_name')||'|'||trim(payload->>'last_name')||'|'||regexp_replace(payload->>'phone','[^0-9]','','g'));
 insert into public.players(first_name,last_name,phone,identity_key) values(trim(payload->>'first_name'),trim(payload->>'last_name'),payload->>'phone',identity) on conflict(identity_key) do update set identity_key=excluded.identity_key returning id into pid;
 if exists(select 1 from public.registrations where event_id=e.id and player_id=pid) then return jsonb_build_object('error','DUPLICATE');end if;
 insert into public.registrations(event_id,player_id,age,category_id,position_id,guardian_name,guardian_phone,guardian_consent,consent,public_consent) values(e.id,pid,(payload->>'age')::int,cat.id,(payload->>'position_id')::uuid,payload->>'guardian_name',payload->>'guardian_phone',coalesce((payload->>'guardian_consent')::boolean,false),true,coalesce((payload->>'public_consent')::boolean,false)) returning id into rid;
 insert into public.audit_logs(event_id,action,target_id) values(e.id,'registration.created',rid::text);
 update public.events set version=version+1 where id=e.id;
 delete from public.rate_limits where window_start<now()-interval '1 day';
 return jsonb_build_object('id',rid,'amount',e.amount,'alias',e.alias,'holder',e.holder,'bank_account',e.bank_account,'payment_instructions',e.payment_instructions);
end$$;

-- The application validates the typed command, computes engines server-side, then
-- invokes this function as the signed-in administrator. One event lock + version
-- serializes every critical mutation and rejects stale browser snapshots.
create function public.admin_apply(command jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
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
 elsif op='competition.update' then
   comp:=(data->>'id')::uuid;
   if not exists(select 1 from public.competitions where id=comp and event_id=e.id) then raise exception 'NOT_FOUND';end if;
   if exists(select 1 from public.teams where competition_id=comp) then raise exception 'COMPETITION_HAS_TEAMS';end if;
   if exists(select 1 from jsonb_array_elements_text(data->'category_ids') x where not exists(select 1 from public.categories where id=x::uuid)) then raise exception 'CATEGORY';end if;
   update public.competitions set name=data->>'name',category_ids=array(select jsonb_array_elements_text(data->'category_ids'))::uuid[],min_age=(data->>'min_age')::int,max_age=(data->>'max_age')::int,allow_mixed_ages=(data->>'allow_mixed_ages')::boolean,authorization_note=data->>'authorization_note',version=version+1 where id=comp;
 elsif op='teams.automatic' then
   comp:=(data->>'competition_id')::uuid;
   update public.competitions set automatic_teams=(data->>'enabled')::boolean,auto_team_size=(data->>'team_size')::int,auto_team_capacity=(data->>'capacity')::int,version=version+1 where id=comp and event_id=e.id;
   if not found then raise exception 'NOT_FOUND';end if;
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
 -- The server computes this plan from the same version of the event. Apply the
 -- registration change and its roster update under this single transaction lock.
 if command->'automatic_teams' is not null and command->'automatic_teams'<>'null'::jsonb then
   comp:=(command->'automatic_teams'->>'competition_id')::uuid;
   if not exists(select 1 from public.competitions where id=comp and event_id=e.id and automatic_teams) then raise exception 'AUTOMATIC_TEAMS_DISABLED';end if;
   if command->'automatic_teams'->>'mode'='rebalance' then
     if exists(select 1 from public.teams where competition_id=comp and published) or exists(select 1 from public.matches where competition_id=comp) or e.state in ('TORNEO_CONFIGURADO','TORNEO_EN_CURSO','TORNEO_FINALIZADO') then raise exception 'ROSTERS_FROZEN';end if;
     if exists(select 1 from public.teams t where t.competition_id=comp and not exists(select 1 from jsonb_array_elements(command->'automatic_teams'->'teams') x where (x->>'id')::uuid=t.id)) then raise exception 'MISSING_EXISTING_TEAM';end if;
     delete from public.team_members where team_id in (select id from public.teams where competition_id=comp);
   elsif command->'automatic_teams'->>'mode'<>'append' then raise exception 'INVALID_AUTO_PLAN';end if;
   for item in select * from jsonb_array_elements(command->'automatic_teams'->'teams') loop
     tid:=(item->>'id')::uuid;
     if coalesce((item->>'is_new')::boolean,false) then
       if command->'automatic_teams'->>'mode'<>'rebalance' then raise exception 'ROSTERS_FROZEN';end if;
       insert into public.teams(id,event_id,competition_id,name) values(tid,e.id,comp,item->>'name');
     elsif not exists(select 1 from public.teams where id=tid and competition_id=comp and event_id=e.id) then raise exception 'NOT_FOUND';end if;
     for sub in select * from jsonb_array_elements(item->'members') loop
       rid:=(sub->>'registration_id')::uuid;
       if not exists(select 1 from public.registrations r join public.competitions c on c.id=comp left join public.player_evaluations v on v.registration_id=r.id where r.id=rid and r.event_id=e.id and r.active and r.payment_status='PAGO_CONFIRMADO' and r.category_id=any(c.category_ids) and r.age between c.min_age and c.max_age and coalesce(v.available,true) and not coalesce(v.excluded,false)) then raise exception 'INELIGIBLE_PLAYER';end if;
       insert into public.team_members(team_id,registration_id,captain,substitute,locked) values(tid,rid,coalesce((sub->>'captain')::boolean,false),coalesce((sub->>'substitute')::boolean,false),coalesce((sub->>'locked')::boolean,false));
     end loop;
     if (select count(*) from public.team_members where team_id=tid)>(select auto_team_capacity from public.competitions where id=comp) then raise exception 'TEAM_CAPACITY';end if;
     update public.teams set version=version+1 where id=tid;
   end loop;
   insert into public.audit_logs(event_id,actor_id,action,target_id,after_data) values(e.id,auth.uid(),'teams.auto.updated',comp::text,command->'automatic_teams');
 end if;
 update public.events set version=version+1 where id=e.id;
 insert into public.audit_logs(event_id,actor_id,action,target_id,before_data,after_data) values(e.id,auth.uid(),op,coalesce(data->>'id',data->>'competition_id'),before_value,command->'data');
 return jsonb_build_object('success',true);
end$$;

-- Function execute privileges are explicit: anonymous never invokes admin writes.
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
revoke all on function public.public_snapshot() from public;
grant execute on function public.public_snapshot() to anon,authenticated;
revoke all on function public.admin_snapshot() from public;
grant execute on function public.admin_snapshot() to authenticated;
revoke all on function public.register_player(jsonb,text) from public,anon,authenticated;
grant execute on function public.register_player(jsonb,text) to service_role;
revoke all on function public.admin_apply(jsonb) from public,anon,authenticated;
grant execute on function public.admin_apply(jsonb) to service_role;
insert into public.events(name,edition) values('SEVEN INTERNO','ANTONIO “TONY” LEYES · 10° ANIVERSARIO');
