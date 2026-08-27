-- Execute with Supabase CLI/db tests in a configured local environment.
-- This file documents the isolation cases that must remain true as later phases add tables.

begin;

-- Expected cases:
-- 1. A member of Clinic A can select Clinic A from public.organizations.
-- 2. The same user cannot select Clinic B unless they have an active membership there.
-- 3. A technical_staff member cannot insert or update organization_members.
-- 4. A clinic_admin can manage organization_members only inside their own organization.
-- 5. Suspended memberships do not satisfy public.is_org_member().

rollback;
