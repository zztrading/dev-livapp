INSERT INTO storage.buckets (id, name, public)
VALUES ('uau-images', 'uau-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "uau-images public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'uau-images');

CREATE POLICY "uau-images admin write"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'uau-images'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'))
);

CREATE POLICY "uau-images admin update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'uau-images'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'))
);

CREATE POLICY "uau-images admin delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'uau-images'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'))
);