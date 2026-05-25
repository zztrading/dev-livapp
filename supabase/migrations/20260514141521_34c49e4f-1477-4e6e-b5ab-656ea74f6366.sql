-- Restrict lesson reads to authenticated users to prevent anonymous access
-- to draft (status='rascunho') lessons that include internal exercise answers
-- and pipeline metadata in their content/exercises jsonb.
DROP POLICY IF EXISTS public_read_active_lessons ON public.lessons;

CREATE POLICY authenticated_read_active_lessons
ON public.lessons
FOR SELECT
TO authenticated
USING (is_active = true);
