-- Prioridad manual para la agenda; no es una clasificación diagnóstica automatizada.
alter table public.follow_ups
  add column urgency text not null default 'normal'
  constraint follow_ups_urgency_check check (urgency in ('normal', 'urgent'));

create index follow_ups_organization_due_active_idx
  on public.follow_ups (organization_id, due_date)
  where deleted_at is null and due_date is not null;
