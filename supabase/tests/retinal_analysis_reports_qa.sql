-- Run: node scripts/test-retinal-reports.mjs
-- Requires the retinal-analysis migration already applied. No reset or seed required.
-- All fixtures, helper functions, and writes live in this one rolled-back transaction.
-- No storage objects, passwords, keys, existing demo records, or real PHI are used.
-- Failed assertions accumulate; negative probes use subtransactions so unexpected
-- successes cannot contaminate later probes. Unexpected setup errors abort psql,
-- closing the connection and rolling back. The runner has a 60-second wall limit.
\set ON_ERROR_STOP on
\set QUIET on
-- psql runs inside the Linux Docker container; suppress void helper result rows.
\o /dev/null
begin;
set local statement_timeout = '8s';
set local lock_timeout = '2s';
set local idle_in_transaction_session_timeout = '15s';
set local timezone = 'UTC';
set local request.jwt.claim.sub = '';
set local request.jwt.claims = '{}';

create temporary table qa_results (
  ordinal integer generated always as identity,
  test text not null, passed boolean not null, detail text
);
create temporary table qa_snapshots (name text primary key, payload jsonb not null);
grant select, insert on qa_results, qa_snapshots to authenticated, anon;
grant usage on sequence qa_results_ordinal_seq to authenticated, anon;

create function pg_temp.id(n integer) returns uuid language sql immutable as $$
  select ('f0910201-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.login(n integer) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', case when n is null then null else pg_temp.id(n)::text end,
    'role', current_user)::text, true);
end;
$$;
create function pg_temp.ok(label text, condition boolean) returns void language plpgsql as $$
begin
  insert into qa_results(test, passed, detail)
  values (label, coalesce(condition, false), case when not coalesce(condition, false) then 'false/null assertion' end);
end;
$$;
create function pg_temp.probe(label text, command text, expected_state text default null)
returns void language plpgsql security invoker as $$
declare result boolean; state text; message text;
begin
  begin
    if expected_state is null then
      execute command into result;
      if result is distinct from true then
        raise exception using errcode = 'QA002', message = 'false/null assertion';
      end if;
    else
      execute command;
      raise exception using errcode = 'QA001', message = 'unexpected success; probe changes reverted';
    end if;
  exception when others then
    get stacked diagnostics state = returned_sqlstate, message = message_text;
  end;
  insert into qa_results(test, passed, detail) values (
    label, case when expected_state is null then state is null else state = expected_state end,
    case when state is not null then state || ': ' || message end);
end;
$$;

-- Fail safely on the extraordinarily unlikely fixed-fixture UUID collision.
do $$ begin
  if exists (select 1 from auth.users where id between pg_temp.id(1) and pg_temp.id(9))
    or exists (select 1 from public.organizations where id in (pg_temp.id(101),pg_temp.id(102))) then
    raise exception 'Retinal QA fixture IDs already exist; no writes performed';
  end if;
end $$;

insert into auth.users(id, email, raw_user_meta_data)
select pg_temp.id(n), 'retinal-qa-' || n || '@example.invalid', '{"display_name":"Synthetic QA"}'::jsonb
from generate_series(1,9) n;
insert into public.organizations(id, name, created_by) values
  (pg_temp.id(101),'Retinal QA synthetic clinic A',pg_temp.id(3)),
  (pg_temp.id(102),'Retinal QA synthetic clinic B',pg_temp.id(4));
insert into public.organization_members(organization_id,user_id,role,status) values
  (pg_temp.id(101),pg_temp.id(1),'authorized_professional','active'),
  (pg_temp.id(101),pg_temp.id(2),'technical_staff','active'),
  (pg_temp.id(101),pg_temp.id(3),'clinic_admin','active'),
  (pg_temp.id(102),pg_temp.id(4),'clinic_admin','active'),
  (pg_temp.id(101),pg_temp.id(8),'authorized_professional','suspended');
insert into public.patients(id,organization_id,internal_identifier,medical_record_code,
  first_names,last_names,date_of_birth,phone,created_by)
select pg_temp.id(n), pg_temp.id(case when n=202 then 102 else 101 end),
  'QA-' || n, 'QA-' || n, 'Synthetic', 'Fixture', '2000-01-01', '00000000', pg_temp.id(1)
from generate_series(201,203) n;
insert into public.patient_accounts(organization_id,patient_id,user_id,created_by) values
  (pg_temp.id(101),pg_temp.id(201),pg_temp.id(5),pg_temp.id(3)),
  (pg_temp.id(102),pg_temp.id(202),pg_temp.id(6),pg_temp.id(4)),
  (pg_temp.id(101),pg_temp.id(203),pg_temp.id(7),pg_temp.id(3));
insert into public.screenings(id,organization_id,patient_id,medical_record_code,status,created_by)
select pg_temp.id(n),pg_temp.id(case when n=302 then 102 else 101 end),
  pg_temp.id(case when n=302 then 202 when n=303 then 203 else 201 end),
  'QA-' || n,'REVISADO',pg_temp.id(1)
from generate_series(301,305) n;
insert into public.retinal_images(id,organization_id,patient_id,screening_id,laterality,
  original_file_name,storage_path,mime_type,size_bytes,hash_sha256,uploaded_by,updated_at)
select pg_temp.id(v.image),s.organization_id,s.patient_id,s.id,v.eye::public.retinal_image_laterality,
  'synthetic-qa.png', s.organization_id || '/' || s.patient_id || '/' || s.id || '/' || v.eye || '/synthetic-qa.png',
  'image/png',1024,repeat('a',64),pg_temp.id(2),now()-interval '1 hour'
from (values (401,301,'OD'),(402,301,'OI'),(403,302,'OD'),(404,303,'OD'),
  (405,304,'OD'),(406,305,'OD')) v(image,screening,eye)
join public.screenings s on s.id=pg_temp.id(v.screening);
insert into public.image_quality_reviews(organization_id,patient_id,screening_id,retinal_image_id,
  reviewer_user_id,quality_status)
select organization_id,patient_id,screening_id,id,pg_temp.id(1),'ADECUADA'
from public.retinal_images where id between pg_temp.id(401) and pg_temp.id(406);
insert into public.professional_reviews(organization_id,patient_id,screening_id,reviewer_user_id,
  review_status,reviewed_at)
select organization_id,patient_id,id,pg_temp.id(case when id=pg_temp.id(302) then 4 else 1 end),
  'REVISION_COMPLETADA',now()+interval '1 minute'
from public.screenings where id between pg_temp.id(301) and pg_temp.id(305);

select pg_temp.ok('RLS enabled on both new tables',
  (select bool_and(relrowsecurity) from pg_class where oid in
    ('public.retinal_analysis_runs'::regclass,'public.retinal_analysis_reports'::regclass)));

set local role authenticated;
select pg_temp.login(2);
select pg_temp.ok('JWT claims and API role are active', auth.uid()=pg_temp.id(2) and current_user='authenticated');
select pg_temp.probe('valid technician save persists with server-derived tenant, patient and model', $q$
  select public.save_retinal_analysis(pg_temp.id(501),pg_temp.id(401),now()-interval '1 hour',
    array[0.1,0.1,0.6,0.1,0.1]::float8[],120)->>'id'=pg_temp.id(501)::text$q$);
select pg_temp.ok('valid save row preserves provenance and predicted class', exists (
  select 1 from public.retinal_analysis_runs where id=pg_temp.id(501)
    and organization_id=pg_temp.id(101) and patient_id=pg_temp.id(201) and screening_id=pg_temp.id(301)
    and retinal_image_id=pg_temp.id(401) and image_updated_at=now()-interval '1 hour'
    and image_sha256=repeat('a',64) and laterality='OD' and created_by=pg_temp.id(2)
    and source='browser_unverified' and predicted_class='muy_alto_riesgo'
    and scores=array[0.1,0.1,0.6,0.1,0.1]::float8[] and elapsed_ms=120
    and model_version='RetinCare CNN · 2026-10-08'
    and model_sha256='2e86c30216fdb012343282e54084b8ae06e5337ad45f287b29c2f573a6141917'));

-- If a positive write is broken, fixture rows still allow independent authorization,
-- approval-precondition and read tests to run. This NEVER turns the failed save green.
set local role postgres;
insert into public.retinal_analysis_runs(id,organization_id,patient_id,screening_id,retinal_image_id,
  image_updated_at,image_sha256,laterality,model_version,model_sha256,scores,predicted_class,
  elapsed_ms,created_by,created_at)
select pg_temp.id(501),organization_id,patient_id,screening_id,id,updated_at,hash_sha256,laterality,
  'RetinCare CNN · 2026-10-08','2e86c30216fdb012343282e54084b8ae06e5337ad45f287b29c2f573a6141917',
  array[0.1,0.1,0.6,0.1,0.1]::float8[],'muy_alto_riesgo',120,pg_temp.id(2),now()
from public.retinal_images where id=pg_temp.id(401)
  and not exists (select 1 from public.retinal_analysis_runs where id=pg_temp.id(501));
insert into qa_snapshots select 'first_run',to_jsonb(r) from public.retinal_analysis_runs r where id=pg_temp.id(501);
select pg_temp.ok('successful save writes exactly one audit event',
  (select count(*) from public.audit_logs where organization_id=pg_temp.id(101)
    and actor_user_id=pg_temp.id(2) and action='screening.updated'
    and entity_type='screening' and entity_id=pg_temp.id(301)
    and metadata->>'event'='retinal_analysis_saved'
    and metadata->>'analysis_id'=pg_temp.id(501)::text
    and metadata->>'source'='browser_unverified')=1);

set local role authenticated;
select pg_temp.login(2);
select pg_temp.probe('identical retry returns unchanged original row', $q$
  select public.save_retinal_analysis(pg_temp.id(501),pg_temp.id(401),now()-interval '1 hour',
    array[0.1,0.1,0.6,0.1,0.1]::float8[],120)=(select payload from qa_snapshots where name='first_run')$q$);
select pg_temp.probe('new run appends a second analysis', $q$
  select public.save_retinal_analysis(pg_temp.id(502),pg_temp.id(401),now()-interval '1 hour',
    array[0.6,0.1,0.1,0.1,0.1]::float8[],130)->>'id'=pg_temp.id(502)::text$q$);
select pg_temp.ok('append keeps original byte-for-byte and has two rows',
  (select count(*) from public.retinal_analysis_runs where retinal_image_id=pg_temp.id(401))=2
  and (select to_jsonb(r) from public.retinal_analysis_runs r where id=pg_temp.id(501))=
    (select payload from qa_snapshots where name='first_run'));

do $$ declare item record; begin
  for item in select * from (values
    ('scores','array[0.2,0.2,0.2,0.2,0.2]::float8[]','now()-interval ''1 hour''','pg_temp.id(401)'),
    ('timestamp','array[0.1,0.1,0.6,0.1,0.1]::float8[]','now()','pg_temp.id(401)'),
    ('image','array[0.1,0.1,0.6,0.1,0.1]::float8[]','now()-interval ''1 hour''','pg_temp.id(402)')
  ) v(label,scores,stamp,img) loop
    perform pg_temp.probe('idempotency key rejects changed ' || item.label,
      format('select public.save_retinal_analysis(pg_temp.id(501),%s,%s,%s,120)',item.img,item.stamp,item.scores),'22023');
  end loop;
end $$;
select pg_temp.login(1);
select pg_temp.probe('idempotency key rejects a different authorized actor', $q$
  select public.save_retinal_analysis(pg_temp.id(501),pg_temp.id(401),now()-interval '1 hour',
    array[0.1,0.1,0.6,0.1,0.1]::float8[],120)$q$,'22023');
select pg_temp.probe('professional can save a valid second-eye analysis', $q$
  select public.save_retinal_analysis(pg_temp.id(503),pg_temp.id(402),now()-interval '1 hour',
    array[0.6,0.1,0.1,0.1,0.1]::float8[],130)->>'id'=pg_temp.id(503)::text$q$);

-- Exact SQLSTATE checks ensure unexpected errors (e.g. broken auditing) cannot pass.
do $$ declare item record; begin
  for item in select * from (values
    ('NULL array','null::float8[]'),('empty array','array[]::float8[]'),
    ('NULL member','array[null,0.25,0.25,0.25,0.25]::float8[]'),
    ('NaN','array[''NaN'',0,0,0,1]::float8[]'),
    ('positive infinity','array[''Infinity'',0,0,0,1]::float8[]'),
    ('negative infinity','array[''-Infinity'',0,0,0,1]::float8[]'),
    ('negative score','array[-0.1,0.2,0.3,0.3,0.3]::float8[]'),
    ('score above one','array[1.1,0,0,0,0]::float8[]'),
    ('bad sum','array[0.1,0.1,0.1,0.1,0.1]::float8[]'),
    ('four scores','array[0.25,0.25,0.25,0.25]::float8[]'),
    ('six scores','array[1,0,0,0,0,0]::float8[]'),
    ('two dimensions','array[[0.2,0.2,0.2,0.2,0.2]]::float8[]'),
    ('zero lower bound','''[0:4]={0.2,0.2,0.2,0.2,0.2}''::float8[]')
  ) v(label,scores) loop
    perform pg_temp.probe('reject malformed scores: ' || item.label,
      format('select public.save_retinal_analysis(pg_temp.id(599),pg_temp.id(405),now()-interval ''1 hour'',%s,1)',item.scores),'22023');
  end loop;
  for item in select * from (values ('NULL','null'),('negative','-1'),('too long','3600001')) v(label,elapsed) loop
    perform pg_temp.probe('reject elapsed time: ' || item.label,
      format('select public.save_retinal_analysis(pg_temp.id(599),pg_temp.id(405),now()-interval ''1 hour'',array[1,0,0,0,0]::float8[],%s)',item.elapsed),'22023');
  end loop;
end $$;
select pg_temp.probe('reject NULL run id', $q$select public.save_retinal_analysis(null,pg_temp.id(405),
  now()-interval '1 hour',array[1,0,0,0,0]::float8[],1)$q$,'22023');
select pg_temp.probe('reject stale image timestamp', $q$select public.save_retinal_analysis(pg_temp.id(599),pg_temp.id(405),
  now(),array[1,0,0,0,0]::float8[],1)$q$,'23514');
select pg_temp.probe('reject NULL image timestamp', $q$select public.save_retinal_analysis(pg_temp.id(599),pg_temp.id(405),
  null,array[1,0,0,0,0]::float8[],1)$q$,'23514');
select pg_temp.probe('reject nonexistent image without disclosure', $q$select public.save_retinal_analysis(pg_temp.id(599),pg_temp.id(499),
  now(),array[1,0,0,0,0]::float8[],1)$q$,'42501');
select pg_temp.probe('reject nonexistent screening without disclosure',
  'select public.approve_retinal_analysis_report(pg_temp.id(399))','42501');

-- Authorization matrix for mutation and direct writes, including real RLS reads.
do $$ declare actor integer; tbl text; action text; begin
  foreach actor in array array[1,2,3,4,5,8,9] loop
    perform pg_temp.login(actor);
    if actor in (4,5,8,9) then
      perform pg_temp.probe('unauthorized save actor ' || actor,$q$select public.save_retinal_analysis(
        pg_temp.id(599),pg_temp.id(401),now()-interval '1 hour',array[1,0,0,0,0]::float8[],1)$q$,'42501');
      perform pg_temp.probe('unauthorized approval actor ' || actor,
        'select public.approve_retinal_analysis_report(pg_temp.id(301))','42501');
      perform pg_temp.ok('drafts invisible to actor ' || actor,
        public.get_screening_retinal_analyses(pg_temp.id(301))='{"analyses":[],"approvedReport":null}'::jsonb);
    end if;
    foreach tbl in array array['retinal_analysis_runs','retinal_analysis_reports'] loop
      foreach action in array array['insert','update','delete'] loop
        perform pg_temp.probe('raw ' || action || ' denied on ' || tbl || ' for actor ' || actor,
          case action when 'insert' then format('insert into public.%I default values',tbl)
          when 'update' then format('update public.%I set organization_id=organization_id where organization_id=pg_temp.id(101)',tbl)
          else format('delete from public.%I where organization_id=pg_temp.id(101)',tbl) end,'42501');
      end loop;
    end loop;
  end loop;
end $$;
select pg_temp.login(2);
select pg_temp.probe('technician cannot approve', 'select public.approve_retinal_analysis_report(pg_temp.id(301))','42501');
select pg_temp.login(null);
select pg_temp.probe('authenticated role without sub cannot save', $q$select public.save_retinal_analysis(
  pg_temp.id(599),pg_temp.id(401),now()-interval '1 hour',array[1,0,0,0,0]::float8[],1)$q$,'42501');
set local role anon;
select pg_temp.login(null);
do $$ declare command text; begin
  foreach command in array array[
    'select public.save_retinal_analysis(pg_temp.id(599),pg_temp.id(401),now(),array[1,0,0,0,0]::float8[],1)',
    'select public.approve_retinal_analysis_report(pg_temp.id(301))',
    'select public.get_screening_retinal_analyses(pg_temp.id(301))',
    'select public.get_patient_retinal_reports()',
    'select * from public.retinal_analysis_runs','select * from public.retinal_analysis_reports',
    'insert into public.retinal_analysis_runs default values','insert into public.retinal_analysis_reports default values'
  ] loop perform pg_temp.probe('anon denied: ' || command,command,'42501'); end loop;
end $$;

set local role postgres;
-- Synthetic fallback runs support the remaining tests even if save's audit fails.
insert into public.retinal_analysis_runs(id,organization_id,patient_id,screening_id,retinal_image_id,
  image_updated_at,image_sha256,laterality,model_version,model_sha256,scores,predicted_class,elapsed_ms,created_by)
select pg_temp.id(v.run),i.organization_id,i.patient_id,i.screening_id,i.id,i.updated_at,i.hash_sha256,i.laterality,
  'RetinCare CNN · 2026-10-08','2e86c30216fdb012343282e54084b8ae06e5337ad45f287b29c2f573a6141917',
  array[0.6,0.1,0.1,0.1,0.1]::float8[],'alto_riesgo',130,pg_temp.id(case when v.run=504 then 4 else 2 end)
from (values (502,401),(503,402),(504,403),(505,404),(506,406)) v(run,img)
join public.retinal_images i on i.id=pg_temp.id(v.img)
where not exists (select 1 from public.retinal_analysis_runs r where r.id=pg_temp.id(v.run));
-- now() is transaction-stable. Explicit fixture timestamps model separate real
-- requests without sleeps and make the latest-per-eye assertion deterministic.
update public.retinal_analysis_runs set created_at=now()-interval '2 minutes' where id=pg_temp.id(501);
update public.retinal_analysis_runs set created_at=now()-interval '1 minute' where id=pg_temp.id(502);

-- Each state mutation is confined to an inner subtransaction, then deliberately
-- reverted while retaining its assertion result. Only fake fixture rows are touched.
create function pg_temp.state_probe(label text, setup_sql text, call_sql text, expected_state text default '23514')
returns void language plpgsql security invoker as $$
declare outcome boolean; diagnostic text;
begin
  begin
    execute setup_sql;
    execute 'set local role authenticated';
    perform pg_temp.login(1);
    perform pg_temp.probe(label,call_sql,expected_state);
    select passed,detail into outcome,diagnostic from qa_results order by ordinal desc limit 1;
    raise exception using errcode='QA003';
  exception when sqlstate 'QA003' then null;
  end;
  insert into qa_results(test,passed,detail) values(label,outcome,diagnostic);
end;
$$;

do $$ declare item record; save_call text := $q$select public.save_retinal_analysis(pg_temp.id(599),pg_temp.id(405),
  (select updated_at from public.retinal_images where id=pg_temp.id(405)),array[1,0,0,0,0]::float8[],1)$q$;
begin
  for item in select * from (values
    ('inactive image','update public.retinal_images set status=''REEMPLAZADA'' where id=pg_temp.id(405)'),
    ('deleted image','update public.retinal_images set deleted_at=now() where id=pg_temp.id(405)'),
    ('inadequate image','update public.image_quality_reviews set quality_status=''INADECUADA'',reasons=array[''DESENFOQUE'']::public.image_quality_reason[] where retinal_image_id=pg_temp.id(405)'),
    ('closed screening','update public.screenings set status=''CERRADO'',closed_at=now() where id=pg_temp.id(304)'),
    ('deleted screening','update public.screenings set deleted_at=now() where id=pg_temp.id(304)'),
    ('archived patient','update public.patients set deleted_at=now() where id=pg_temp.id(201)')
  ) v(label,setup) loop
    perform pg_temp.state_probe('save rejects ' || item.label,item.setup,save_call);
  end loop;
end $$;

-- Approval must inspect a completed, current professional review and ADECUADA image.
do $$ declare item record; begin
  for item in select * from (values
    ('missing review','delete from public.professional_reviews where screening_id=pg_temp.id(305)'),
    ('in-progress review','update public.professional_reviews set review_status=''EN_REVISION'' where screening_id=pg_temp.id(305)'),
    ('deleted review','update public.professional_reviews set deleted_at=now() where screening_id=pg_temp.id(305)'),
    ('review before latest analysis','update public.professional_reviews set reviewed_at=now()-interval ''1 second'' where screening_id=pg_temp.id(305)'),
    ('screening not reviewed','update public.screenings set status=''PENDIENTE_REVISION'' where id=pg_temp.id(305)'),
    ('closed screening','update public.screenings set status=''CERRADO'',closed_at=now() where id=pg_temp.id(305)'),
    ('deleted screening','update public.screenings set deleted_at=now() where id=pg_temp.id(305)'),
    ('missing quality review','delete from public.image_quality_reviews where retinal_image_id=pg_temp.id(406)'),
    ('pending quality','update public.image_quality_reviews set quality_status=''PENDIENTE'' where retinal_image_id=pg_temp.id(406)'),
    ('inadequate quality','update public.image_quality_reviews set quality_status=''INADECUADA'',reasons=array[''DESENFOQUE'']::public.image_quality_reason[] where retinal_image_id=pg_temp.id(406)'),
    ('inactive image','update public.retinal_images set status=''REEMPLAZADA'' where id=pg_temp.id(406)'),
    ('deleted image','update public.retinal_images set deleted_at=now() where id=pg_temp.id(406)'),
    ('stale image','update public.retinal_images set hash_sha256=repeat(''b'',64) where id=pg_temp.id(406)')
  ) v(label,setup) loop
    perform pg_temp.state_probe('approval rejects ' || item.label,item.setup,
      'select public.approve_retinal_analysis_report(pg_temp.id(305))');
  end loop;
end $$;

select pg_temp.state_probe('review after an old run but before newest run cannot approve', $q$
  insert into public.retinal_analysis_runs
  select (jsonb_populate_record(null::public.retinal_analysis_runs,
    to_jsonb(r)||jsonb_build_object('id',pg_temp.id(507),'created_at',now()+interval '2 minutes'))).*
  from public.retinal_analysis_runs r where id=pg_temp.id(506)$q$,
  'select public.approve_retinal_analysis_report(pg_temp.id(305))');

set local role authenticated;
select pg_temp.login(5);
select pg_temp.ok('patient sees no annex before approval/publication',public.get_patient_retinal_reports()='[]'::jsonb);
select pg_temp.login(1);
select pg_temp.probe('professional approves reviewed ADECUADA analyses', $q$
  select jsonb_array_length(public.approve_retinal_analysis_report(pg_temp.id(301))->'analyses')=2$q$);
select pg_temp.ok('approval persists only latest analysis per eye',
  (select analyses @> jsonb_build_array(jsonb_build_object('id',pg_temp.id(502)),jsonb_build_object('id',pg_temp.id(503)))
    and not analyses @> jsonb_build_array(jsonb_build_object('id',pg_temp.id(501)))
    and organization_id=pg_temp.id(101) and patient_id=pg_temp.id(201) and approved_by=pg_temp.id(1)
   from public.retinal_analysis_reports where screening_id=pg_temp.id(301)));
set local role postgres;
select pg_temp.ok('approval has exactly one audit event',
  (select count(*) from public.audit_logs where entity_id=pg_temp.id(301)
    and metadata->>'event'='experimental_annex_approved')=1);
set local role authenticated;
select pg_temp.login(4);
select pg_temp.probe('clinic coordinator can approve own clinic report', $q$
  select public.approve_retinal_analysis_report(pg_temp.id(302))->>'organization_id'=pg_temp.id(102)::text$q$);
set local role postgres;

-- Report fallback is intentionally explicit: read/immutability probes remain useful
-- when approval is broken; the approval failures above still fail the entire suite.
insert into public.retinal_analysis_reports(screening_id,organization_id,patient_id,analyses,approved_by)
select s.id,s.organization_id,s.patient_id,
  (select jsonb_agg(to_jsonb(r) order by r.laterality) from public.retinal_analysis_runs r
    where r.screening_id=s.id and r.id<>pg_temp.id(501)),
  pg_temp.id(case when s.id=pg_temp.id(302) then 4 else 1 end)
from public.screenings s where s.id in (pg_temp.id(301),pg_temp.id(302),pg_temp.id(303))
  and not exists (select 1 from public.retinal_analysis_reports p where p.screening_id=s.id);
insert into qa_snapshots select 'approved',to_jsonb(r) from public.retinal_analysis_reports r where screening_id=pg_temp.id(301);
insert into qa_snapshots select 'audit_counts',jsonb_build_object('save',
  (select count(*) from public.audit_logs where entity_id=pg_temp.id(301)
    and action='screening.updated' and entity_type='screening'
    and metadata->>'event'='retinal_analysis_saved' and metadata->>'analysis_id'=pg_temp.id(501)::text), 'approval',
  (select count(*) from public.audit_logs where entity_id=pg_temp.id(301) and metadata->>'event'='experimental_annex_approved'));

set local role authenticated;
select pg_temp.login(1);
select pg_temp.probe('approval retry returns identical snapshot', $q$
  select public.approve_retinal_analysis_report(pg_temp.id(301))=(select payload from qa_snapshots where name='approved')$q$);
select pg_temp.probe('approved screening rejects new analysis', $q$
  select public.save_retinal_analysis(pg_temp.id(599),pg_temp.id(401),now()-interval '1 hour',array[1,0,0,0,0]::float8[],1)$q$,'23514');
select pg_temp.login(2);
select pg_temp.probe('technician cannot reuse an approved report', 'select public.approve_retinal_analysis_report(pg_temp.id(301))','42501');
select pg_temp.login(4);
select pg_temp.ok('other clinic cannot see approved report via staff RPC',
  public.get_screening_retinal_analyses(pg_temp.id(301))='{"analyses":[],"approvedReport":null}'::jsonb);
select pg_temp.ok('clinic B staff can see own draft and approved report',
  jsonb_array_length(public.get_screening_retinal_analyses(pg_temp.id(302))->'analyses')=1
  and public.get_screening_retinal_analyses(pg_temp.id(302))->'approvedReport'->>'organization_id'=pg_temp.id(102)::text);
select pg_temp.login(1);
select pg_temp.ok('clinic A staff cannot read clinic B draft or report',
  public.get_screening_retinal_analyses(pg_temp.id(302))='{"analyses":[],"approvedReport":null}'::jsonb);
select pg_temp.login(5);
select pg_temp.ok('approved annex stays invisible until publication', public.get_patient_retinal_reports()='[]'::jsonb);
select pg_temp.ok('patient cannot read raw run or annex tables',
  (select count(*) from public.retinal_analysis_runs)=0 and (select count(*) from public.retinal_analysis_reports)=0);
select pg_temp.login(1);
select pg_temp.probe('publish approved screening via audited RPC', $q$
  select (public.publish_screening_to_patient(pg_temp.id(301))).patient_published_at is not null$q$);
select pg_temp.probe('publish other patient in same clinic', $q$
  select (public.publish_screening_to_patient(pg_temp.id(303))).patient_published_at is not null$q$);
select pg_temp.login(4);
select pg_temp.probe('publish clinic B report as its coordinator', $q$
  select (public.publish_screening_to_patient(pg_temp.id(302))).patient_published_at is not null$q$);
select pg_temp.login(5);
select pg_temp.ok('patient sees exactly own published annex and sanitized analysis fields',
  jsonb_array_length(public.get_patient_retinal_reports())=1
  and public.get_patient_retinal_reports()->0->>'screeningId'=pg_temp.id(301)::text
  and jsonb_array_length(public.get_patient_retinal_reports()->0->'analyses')=2
  and (select bool_and((a-array['laterality','modelVersion','scores','createdAt'])='{}'::jsonb)
    from jsonb_array_elements(public.get_patient_retinal_reports()->0->'analyses') a));
select pg_temp.login(6);
select pg_temp.ok('clinic B patient sees only clinic B report',
  jsonb_array_length(public.get_patient_retinal_reports())=1
  and public.get_patient_retinal_reports()->0->>'screeningId'=pg_temp.id(302)::text);
select pg_temp.login(7);
select pg_temp.ok('same-clinic different patient sees only their own report',
  jsonb_array_length(public.get_patient_retinal_reports())=1
  and public.get_patient_retinal_reports()->0->>'screeningId'=pg_temp.id(303)::text);

-- Publish a screening with no annex, then prove neither save nor first approval can
-- retroactively attach experimental data after publication.
select pg_temp.login(1);
select pg_temp.probe('publish screening without annex', $q$
  select (public.publish_screening_to_patient(pg_temp.id(305))).patient_published_at is not null$q$);
select pg_temp.probe('published screening rejects first approval',
  'select public.approve_retinal_analysis_report(pg_temp.id(305))','23514');
select pg_temp.probe('published screening rejects new save', $q$select public.save_retinal_analysis(
  pg_temp.id(599),pg_temp.id(406),now()-interval '1 hour',array[1,0,0,0,0]::float8[],1)$q$,'23514');

set local role postgres;
-- Only source fixture data changes: an approved JSON snapshot must remain frozen.
update public.retinal_images set status='REEMPLAZADA',hash_sha256=repeat('b',64) where id=pg_temp.id(401);
update public.image_quality_reviews set quality_status='INADECUADA',reasons=array['DESENFOQUE']::public.image_quality_reason[]
where retinal_image_id=pg_temp.id(402);
update public.professional_reviews set notes='Synthetic later note',reviewed_at=now()+interval '2 minutes'
where screening_id=pg_temp.id(301);
set local role authenticated;
select pg_temp.login(1);
select pg_temp.ok('approved snapshot unchanged after source edits',
  public.approve_retinal_analysis_report(pg_temp.id(301))=(select payload from qa_snapshots where name='approved'));
select pg_temp.login(5);
select pg_temp.ok('published patient data still uses frozen snapshot',
  public.get_patient_retinal_reports()->0->'analyses'->0->'scores'=
  (select payload->'analyses'->0->'scores' from qa_snapshots where name='approved'));
select pg_temp.login(2);
select pg_temp.probe('identical save retry after publication returns original without mutation', $q$
  select public.save_retinal_analysis(pg_temp.id(501),pg_temp.id(401),now()-interval '1 hour',
    array[0.1,0.1,0.6,0.1,0.1]::float8[],120)->>'id'=pg_temp.id(501)::text$q$);

set local role postgres;
select pg_temp.ok('save and approval retries do not duplicate audit events',
  (select count(*) from public.audit_logs where entity_id=pg_temp.id(301)
    and action='screening.updated' and entity_type='screening'
    and metadata->>'event'='retinal_analysis_saved' and metadata->>'analysis_id'=pg_temp.id(501)::text)=
    (select (payload->>'save')::bigint from qa_snapshots where name='audit_counts')
  and (select count(*) from public.audit_logs where entity_id=pg_temp.id(301) and metadata->>'event'='experimental_annex_approved')=
    (select (payload->>'approval')::bigint from qa_snapshots where name='audit_counts'));
select pg_temp.state_probe('deleted screening hides patient annex',
  'update public.screenings set deleted_at=now() where id=pg_temp.id(301)',
  $q$select pg_temp.login(5); select public.get_patient_retinal_reports()='[]'::jsonb$q$,null);
select pg_temp.state_probe('suspended patient RPC denied',
  'update public.patient_accounts set status=''suspended'' where user_id=pg_temp.id(5)',
  'select pg_temp.login(5); select public.get_patient_retinal_reports()','42501');
set local role authenticated;
select pg_temp.login(3);
select pg_temp.probe('coordinator revokes synthetic patient via RPC', $q$
  select (public.revoke_patient_account(pg_temp.id(101),pg_temp.id(201))).status='revoked'$q$);
select pg_temp.login(5);
select pg_temp.probe('revoked patient cannot read published annex', 'select public.get_patient_retinal_reports()','42501');
select pg_temp.ok('revoked patient cannot read raw tables',
  (select count(*) from public.retinal_analysis_runs)=0 and (select count(*) from public.retinal_analysis_reports)=0);

set local role postgres;
select pg_temp.ok('negative probes never persisted candidate run',
  not exists(select 1 from public.retinal_analysis_runs where id=pg_temp.id(599)));
\unset QUIET
\o
select test,detail from qa_results where not passed order by ordinal;
select count(*) as total, count(*) filter(where passed) as passed,
  count(*) filter(where not passed) as failed from qa_results;
select bool_and(passed) as qa_passed from qa_results \gset
rollback;
-- Read-only post-rollback proof, independent of temporary functions/tables.
select not exists(select 1 from auth.users where id between 'f0910201-0000-4000-8000-000000000001' and 'f0910201-0000-4000-8000-000000000009')
  and not exists(select 1 from public.organizations where id in ('f0910201-0000-4000-8000-000000000101','f0910201-0000-4000-8000-000000000102'))
  as rollback_clean \gset
\if :rollback_clean
  \echo 'ROLLBACK verified: synthetic users and clinics absent.'
\else
  \echo 'ERROR: synthetic fixtures remain after rollback.'
  do $$ begin raise exception 'Retinal QA rollback verification failed'; end $$;
\endif
\if :qa_passed
  \echo 'Retinal analysis reports QA: PASS'
\else
  \echo 'Retinal analysis reports QA: FAIL (see assertions above)'
  do $$ begin raise exception 'Retinal analysis reports QA assertions failed'; end $$;
\endif
