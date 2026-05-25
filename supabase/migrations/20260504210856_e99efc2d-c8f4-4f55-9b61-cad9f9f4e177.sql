-- A) Realtime: remove users PII from publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.users;

-- B) lesson_ratings: remove anonymous read access
DROP POLICY IF EXISTS "public_read_ratings" ON public.lesson_ratings;

CREATE POLICY "authenticated_read_approved_ratings"
ON public.lesson_ratings
FOR SELECT
TO authenticated
USING (is_approved = true OR auth.uid() = user_id);

-- C) tts-cache: restrict upload to authenticated users
DROP POLICY IF EXISTS "Service role can upload TTS cache" ON storage.objects;

CREATE POLICY "tts_cache_authenticated_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'tts-cache');

CREATE POLICY "tts_cache_authenticated_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'tts-cache')
WITH CHECK (bucket_id = 'tts-cache');

-- D) lesson-audios: restrict INSERT/UPDATE to admin role
DROP POLICY IF EXISTS "Authenticated users can upload lesson audios" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update lesson audios" ON storage.objects;

CREATE POLICY "lesson_audios_admin_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lesson-audios' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "lesson_audios_admin_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'lesson-audios' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'lesson-audios' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "lesson_audios_service_role_all"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'lesson-audios')
WITH CHECK (bucket_id = 'lesson-audios');