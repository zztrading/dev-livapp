
-- Allow authenticated users to read exercises tied to active lessons (still hides correct_answer-only via app layer; this just enables playback)
CREATE POLICY "authenticated_read_exercises_active_lessons"
ON public.exercises
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.id = exercises.lesson_id AND l.is_active = true
  )
);

-- Tighten tts-cache storage writes to service_role/admin only
DROP POLICY IF EXISTS tts_cache_authenticated_insert ON storage.objects;
DROP POLICY IF EXISTS tts_cache_authenticated_update ON storage.objects;

CREATE POLICY "tts_cache_admin_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'tts-cache' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "tts_cache_admin_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'tts-cache' AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'tts-cache' AND public.has_role(auth.uid(), 'admin'::public.app_role));
