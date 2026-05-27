-- Issue #1: Admins can view onboarding analytics events
CREATE POLICY "admins_view_onboarding_v2_events"
ON public.onboarding_v2_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Issue #3: Limit uau-images uploads to 10MB
UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp']
WHERE id = 'uau-images';