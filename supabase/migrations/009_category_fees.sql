-- Freeze each registration's category fee and reuse it for payment accounting.
alter table public.categories add column if not exists registration_fee numeric(12,2) check(registration_fee>=0);
alter table public.registrations add column if not exists quoted_amount numeric(12,2) check(quoted_amount>=0);
update public.categories set name='Vetecedros' where name='Veteranos';
update public.categories set registration_fee=case when name='M14' then 12000 when name in ('M15','M16','M17') then 15000 else 20000 end where name in ('M14','M15','M16','M17','M19','PADRENCES','Vetecedros','Plantel Superior');
update public.registrations r set quoted_amount=e.amount from public.events e where r.event_id=e.id and r.quoted_amount is null;
create or replace function public.quote_registration_fee() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if TG_OP='INSERT' then
  select coalesce(c.registration_fee,e.amount) into new.quoted_amount from public.categories c cross join public.events e where c.id=new.category_id and e.id=new.event_id;
 elsif new.category_id<>old.category_id then
  if old.payment_status='PAGO_CONFIRMADO' or exists(select 1 from public.payment_records where registration_id=old.id and status='PAGO_CONFIRMADO') then raise exception 'No se puede cambiar la categoría después de confirmar un pago.';end if;
  select coalesce(c.registration_fee,e.amount) into new.quoted_amount from public.categories c cross join public.events e where c.id=new.category_id and e.id=new.event_id;
 else new.quoted_amount:=old.quoted_amount;
 end if;
 return new;
end$$;
drop trigger if exists registration_fee_quote on public.registrations;
create trigger registration_fee_quote before insert or update on public.registrations for each row execute function public.quote_registration_fee();
create or replace function public.record_quoted_payment() returns trigger language plpgsql security definer set search_path=public as $$
begin
 select quoted_amount into new.amount from public.registrations where id=new.registration_id;
 if new.amount is null then raise exception 'Falta el importe de la inscripción.';end if;
 return new;
end$$;
drop trigger if exists payment_fee_quote on public.payment_records;
create trigger payment_fee_quote before insert on public.payment_records for each row execute function public.record_quoted_payment();
revoke all on function public.quote_registration_fee() from public,anon,authenticated;
revoke all on function public.record_quoted_payment() from public,anon,authenticated;

create or replace function public.register_player(payload jsonb, ip_hash text) returns jsonb language plpgsql security definer set search_path=public as $$
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
 return jsonb_build_object('id',rid,'amount',(select quoted_amount from public.registrations where id=rid),'alias',e.alias,'holder',e.holder,'bank_account',e.bank_account,'payment_instructions',e.payment_instructions);
end$$;

