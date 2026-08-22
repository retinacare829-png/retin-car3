-- Execute with Supabase CLI/db tests in a configured local environment.
-- These cases intentionally avoid real patient data.

begin;

-- Expected cases:
-- 1. A member of Clinic A can select patients where organization_id = Clinic A.
-- 2. The same member cannot select patients from Clinic B.
-- 3. An authorized_professional can read patients but cannot insert/update/archive them.
-- 4. A technical_staff member can create and update patients inside their organization.
-- 5. Soft delete sets deleted_at/deleted_by and does not physically remove the row.
-- 6. Patient writes create audit_logs without storing clinical free text in metadata.

rollback;
