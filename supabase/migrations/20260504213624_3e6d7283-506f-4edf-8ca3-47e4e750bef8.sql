-- 1) exercises: remover leitura aberta (vazava correct_answer/explanation)
DROP POLICY IF EXISTS "users_view_exercises_without_answers" ON public.exercises;
DROP POLICY IF EXISTS "admins_view_exercises_with_answers" ON public.exercises;

CREATE POLICY "admins_select_exercises"
ON public.exercises
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2) Realtime: remover pipeline_executions da publicação
ALTER PUBLICATION supabase_realtime DROP TABLE public.pipeline_executions;