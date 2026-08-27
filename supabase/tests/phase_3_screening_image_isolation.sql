-- Execute with Supabase CLI/db tests in a configured local environment.
-- These cases intentionally avoid real patient data and diagnosis assertions.

begin;

-- Expected cases:
-- 1. A member of Clinic A can select screenings, retinal_images and image_quality_reviews for Clinic A.
-- 2. The same member cannot select screenings or images from Clinic B.
-- 3. A technical_staff member can create screenings and upload or replace OD/OI images.
-- 4. An authorized_professional can read and download through private Storage policies, but cannot upload images.
-- 5. Quality review accepts ADECUADA, PENDIENTE or INADECUADA with non-diagnostic reasons only.
-- 6. INADECUADA records suggestion = 'Repetir captura' and does not block screening updates.
-- 7. Audit and patient_timeline_events record lifecycle events without storing free clinical text in metadata.
-- 8. No public Storage bucket or public image URL is required for retinal images.

rollback;
