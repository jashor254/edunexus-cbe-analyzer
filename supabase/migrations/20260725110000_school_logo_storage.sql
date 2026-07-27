-- School branding (crest/logo) shown on the Learner Blueprint cover/header
-- and other institutional-facing report surfaces. Unlike class-resources /
-- assignment-submissions (private, learner-owned files), a school logo is
-- a public branding asset — public=true so <img> tags and the PDF export's
-- headless-Chromium render can load it directly via getPublicUrl, no
-- signed-URL plumbing needed.
INSERT INTO storage.buckets (id, name, public)
VALUES ('school-logos', 'school-logos', true)
ON CONFLICT (id) DO NOTHING;

-- No storage.objects policy for anon/authenticated — same posture as
-- class-resources: writes only through the service-role client in
-- app/api/core/school/logo, gated by requireSchoolAdmin. Public=true on
-- the bucket itself is what makes reads work without a policy.
