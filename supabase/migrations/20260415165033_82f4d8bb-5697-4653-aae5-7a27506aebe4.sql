
CREATE TABLE public.exercise_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL,
  lesson_title TEXT,
  lesson_active BOOLEAN DEFAULT true,
  exercise_id TEXT NOT NULL,
  section_index INTEGER NOT NULL DEFAULT 0,
  section_title TEXT,
  exercise_type TEXT NOT NULL,
  exercise_data JSONB NOT NULL,
  source_array TEXT DEFAULT 'inlineExercises',
  audit_status TEXT DEFAULT 'pending',
  errors_found JSONB DEFAULT '[]'::jsonb,
  corrected_data JSONB,
  correction_reason TEXT,
  section_content TEXT,
  applied_by UUID,
  applied_at TIMESTAMPTZ,
  audited_at TIMESTAMPTZ,
  corrected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lesson_id, exercise_id)
);

ALTER TABLE public.exercise_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_all_exercise_audits"
  ON public.exercise_audits FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "service_role_all_exercise_audits"
  ON public.exercise_audits FOR ALL
  TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

CREATE INDEX idx_exercise_audits_lesson_id ON public.exercise_audits(lesson_id);
CREATE INDEX idx_exercise_audits_status ON public.exercise_audits(audit_status);
