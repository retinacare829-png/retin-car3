-- Browser inference is experimental, not a trusted clinical decision. Append-only
-- runs and an explicitly approved, immutable annex; no patient access to drafts.
create table public.retinal_analysis_runs (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id),
  patient_id uuid not null references public.patients(id),
  screening_id uuid not null references public.screenings(id),
  retinal_image_id uuid not null references public.retinal_images(id),
  image_updated_at timestamptz not null,
  image_sha256 text,
  laterality public.retinal_image_laterality not null,
  model_version text not null,
  model_sha256 text not null,
  source text not null default 'browser_unverified' check (source = 'browser_unverified'),
  scores double precision[] not null,
  predicted_class text not null,
  elapsed_ms integer not null check (elapsed_ms between 0 and 3600000),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index retinal_analysis_runs_screening_idx on public.retinal_analysis_runs(organization_id, screening_id, created_at desc);
create index retinal_analysis_runs_patient_idx on public.retinal_analysis_runs(patient_id);
create index retinal_analysis_runs_image_idx on public.retinal_analysis_runs(retinal_image_id);
create index retinal_analysis_runs_actor_idx on public.retinal_analysis_runs(created_by);

create table public.retinal_analysis_reports (
  screening_id uuid primary key references public.screenings(id),
  organization_id uuid not null references public.organizations(id),
  patient_id uuid not null references public.patients(id),
  analyses jsonb not null check (jsonb_typeof(analyses) = 'array'),
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null default now()
);
create index retinal_analysis_reports_org_idx on public.retinal_analysis_reports(organization_id);
create index retinal_analysis_reports_patient_idx on public.retinal_analysis_reports(patient_id);
create index retinal_analysis_reports_actor_idx on public.retinal_analysis_reports(approved_by);

alter table public.retinal_analysis_runs enable row level security;
alter table public.retinal_analysis_reports enable row level security;
revoke all on public.retinal_analysis_runs, public.retinal_analysis_reports from public, anon, authenticated;
grant select on public.retinal_analysis_runs, public.retinal_analysis_reports to authenticated;
create policy "clinic staff read experimental runs" on public.retinal_analysis_runs for select to authenticated
using (public.has_org_role(organization_id, array['clinic_admin','technical_staff','authorized_professional']::public.organization_role[])
  and not exists (select 1 from public.patient_accounts a where a.user_id = (select auth.uid()) and a.status in ('active','suspended')));
create policy "clinic staff read approved annexes" on public.retinal_analysis_reports for select to authenticated
using (public.has_org_role(organization_id, array['clinic_admin','technical_staff','authorized_professional']::public.organization_role[])
  and not exists (select 1 from public.patient_accounts a where a.user_id = (select auth.uid()) and a.status in ('active','suspended')));

create function public.save_retinal_analysis(target_run_id uuid, target_image_id uuid,
  target_image_updated_at timestamptz, target_scores double precision[], target_elapsed_ms integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  img public.retinal_images;
  visit public.screenings;
  saved public.retinal_analysis_runs;
  classes text[] := array['alto_riesgo','bajo_riesgo','muy_alto_riesgo','muy_bajo_riesgo','riesgo_moderado'];
  top_index integer;
  actor uuid := (select auth.uid());
begin
  select * into img from public.retinal_images where id = target_image_id;
  if actor is null or img.id is null or not public.has_org_role(img.organization_id,
    array['clinic_admin','technical_staff','authorized_professional']::public.organization_role[])
    or exists (select 1 from public.patient_accounts where user_id = actor and status in ('active','suspended')) then
    raise exception using errcode = '42501', message = 'No tiene permiso para guardar este análisis.';
  end if;
  -- Serialize saves with publication/approval. Lock the image again after the visit.
  select * into visit from public.screenings where id = img.screening_id for update;
  select * into img from public.retinal_images where id = target_image_id for update;
  select * into saved from public.retinal_analysis_runs where id = target_run_id;
  if found then
    if saved.created_by <> actor or saved.retinal_image_id <> img.id or saved.scores is distinct from target_scores
      or saved.image_updated_at is distinct from target_image_updated_at then
      raise exception using errcode = '22023', message = 'El identificador del análisis ya fue utilizado.';
    end if;
    return to_jsonb(saved);
  end if;
  if visit.deleted_at is not null or visit.status = 'CERRADO' or visit.patient_published_at is not null
    or exists (select 1 from public.retinal_analysis_reports where screening_id = visit.id)
    or img.status <> 'ACTIVA' or img.deleted_at is not null or img.updated_at is distinct from target_image_updated_at
    or img.organization_id <> visit.organization_id or img.patient_id <> visit.patient_id
    or not exists (select 1 from public.patients where id = img.patient_id and deleted_at is null)
    or exists (select 1 from public.image_quality_reviews where retinal_image_id = img.id and quality_status = 'INADECUADA') then
    raise exception using errcode = '23514', message = 'La visita está publicada, cerrada o la imagen cambió. No se guardó el análisis.';
  end if;
  if target_run_id is null or target_elapsed_ms is null or target_elapsed_ms not between 0 and 3600000
    or target_scores is null or array_ndims(target_scores) <> 1 or array_lower(target_scores,1) <> 1
    or cardinality(target_scores) <> 5
    or exists (select 1 from unnest(target_scores) s where s is null or not (s >= 0 and s <= 1))
    or abs((select sum(s) from unnest(target_scores) s) - 1) > 0.001 then
    raise exception using errcode = '22023', message = 'Las puntuaciones del modelo no son válidas.';
  end if;
  select i into top_index from generate_subscripts(target_scores,1) i order by target_scores[i] desc, i limit 1;
  insert into public.retinal_analysis_runs (id, organization_id, patient_id, screening_id, retinal_image_id,
    image_updated_at, image_sha256, laterality, model_version, model_sha256, scores, predicted_class, elapsed_ms, created_by)
  values (target_run_id, img.organization_id, img.patient_id, img.screening_id, img.id, img.updated_at,
    img.hash_sha256, img.laterality, 'RetinCare CNN · 2026-10-08',
    '2e86c30216fdb012343282e54084b8ae06e5337ad45f287b29c2f573a6141917',
    target_scores, classes[top_index], target_elapsed_ms, actor) returning * into saved;
  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (img.organization_id, actor, 'screening.updated', 'screening', img.screening_id,
    jsonb_build_object('event', 'retinal_analysis_saved', 'analysis_id', saved.id, 'source', 'browser_unverified'));
  return to_jsonb(saved);
end;
$$;
revoke all on function public.save_retinal_analysis(uuid,uuid,timestamptz,double precision[],integer) from public, anon;
grant execute on function public.save_retinal_analysis(uuid,uuid,timestamptz,double precision[],integer) to authenticated;

create function public.get_screening_retinal_analyses(target_screening_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'analyses', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from
      (select * from public.retinal_analysis_runs where screening_id = target_screening_id order by created_at desc limit 50) r), '[]'::jsonb),
    'approvedReport', (select to_jsonb(p) from public.retinal_analysis_reports p where p.screening_id = target_screening_id));
$$;
revoke all on function public.get_screening_retinal_analyses(uuid) from public, anon;
grant execute on function public.get_screening_retinal_analyses(uuid) to authenticated;

create function public.approve_retinal_analysis_report(target_screening_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  visit public.screenings;
  report public.retinal_analysis_reports;
  snapshot jsonb;
  reviewed timestamptz;
  actor uuid := (select auth.uid());
begin
  select * into visit from public.screenings where id = target_screening_id for update;
  if actor is null or visit.id is null or not (public.is_org_coordinator(visit.organization_id)
    or public.has_org_role(visit.organization_id, array['authorized_professional']::public.organization_role[]))
    or exists (select 1 from public.patient_accounts where user_id = actor and status in ('active','suspended')) then
    raise exception using errcode = '42501', message = 'Solo un profesional autorizado puede aprobar el anexo.';
  end if;
  select * into report from public.retinal_analysis_reports where screening_id = visit.id;
  if found then return to_jsonb(report); end if;
  select reviewed_at into reviewed from public.professional_reviews where screening_id = visit.id
    and organization_id = visit.organization_id and patient_id = visit.patient_id and deleted_at is null
    and review_status in ('REVISION_COMPLETADA','SEGUIMIENTO_REQUERIDO');
  if visit.deleted_at is not null or visit.patient_published_at is not null
    or visit.status not in ('REVISADO','SEGUIMIENTO_REQUERIDO') or reviewed is null then
    raise exception using errcode = '23514', message = 'Complete la revisión profesional antes de aprobar el anexo y publicar.';
  end if;
  -- Snapshot only the latest run for each current, quality-approved image.
  perform 1 from public.retinal_images where screening_id = visit.id for update;
  select jsonb_agg(to_jsonb(r) order by r.laterality) into snapshot from (
    select distinct on (runs.laterality) runs.* from public.retinal_analysis_runs runs
    join public.retinal_images img on img.id = runs.retinal_image_id
      and img.updated_at = runs.image_updated_at and img.status = 'ACTIVA' and img.deleted_at is null
    join public.image_quality_reviews q on q.retinal_image_id = img.id and q.quality_status = 'ADECUADA'
    where runs.screening_id = visit.id order by runs.laterality, runs.created_at desc
  ) r;
  if snapshot is null then
    raise exception using errcode = '23514', message = 'No hay análisis vigentes con calidad adecuada para aprobar.';
  end if;
  if exists (select 1 from jsonb_array_elements(snapshot) r where (r->>'created_at')::timestamptz > reviewed) then
    raise exception using errcode = '23514', message = 'Actualice la revisión profesional después de evaluar estos análisis.';
  end if;
  insert into public.retinal_analysis_reports(screening_id,organization_id,patient_id,analyses,approved_by)
  values (visit.id,visit.organization_id,visit.patient_id,snapshot,actor) returning * into report;
  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (visit.organization_id,actor,'screening.updated','screening',visit.id,
    jsonb_build_object('event','experimental_annex_approved','count',jsonb_array_length(snapshot)));
  return to_jsonb(report);
end;
$$;
revoke all on function public.approve_retinal_analysis_report(uuid) from public, anon;
grant execute on function public.approve_retinal_analysis_report(uuid) to authenticated;

create function public.get_patient_retinal_reports()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare account public.patient_accounts; result jsonb;
begin
  select * into account from public.patient_accounts where user_id = (select auth.uid()) and status = 'active';
  if not found then raise exception using errcode='42501', message='No hay una cuenta de paciente activa.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('screeningId', report.screening_id, 'approvedAt', report.approved_at,
    'analyses', (select jsonb_agg(jsonb_build_object('laterality',r->'laterality','modelVersion',r->'model_version',
      'scores',r->'scores','createdAt',r->'created_at')) from jsonb_array_elements(report.analyses) r))), '[]'::jsonb)
  into result from public.retinal_analysis_reports report
  join public.screenings visit on visit.id = report.screening_id and visit.organization_id = report.organization_id
  join public.patients patient on patient.id = report.patient_id and patient.organization_id = report.organization_id
  where report.patient_id = account.patient_id and report.organization_id = account.organization_id
    and visit.patient_published_at is not null and visit.deleted_at is null and patient.deleted_at is null
    and visit.status in ('REVISADO','SEGUIMIENTO_REQUERIDO','CERRADO');
  return result;
end;
$$;
revoke all on function public.get_patient_retinal_reports() from public, anon;
grant execute on function public.get_patient_retinal_reports() to authenticated;
comment on table public.retinal_analysis_runs is 'Unverified browser CNN outputs; immutable experimental drafts, never an automated diagnosis.';
comment on table public.retinal_analysis_reports is 'Immutable professionally approved annex. Patient visibility also requires explicit screening publication.';
