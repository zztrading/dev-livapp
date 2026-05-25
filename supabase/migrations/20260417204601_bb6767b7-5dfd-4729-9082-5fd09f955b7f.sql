ALTER TABLE public.lesson_reports
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'novo',
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS resolved_by uuid NULL,
  ADD COLUMN IF NOT EXISTS admin_notes text NULL;

ALTER TABLE public.lesson_reports
  DROP CONSTRAINT IF EXISTS lesson_reports_status_check;

ALTER TABLE public.lesson_reports
  ADD CONSTRAINT lesson_reports_status_check
  CHECK (status IN ('novo', 'em_analise', 'resolvido', 'descartado'));

CREATE INDEX IF NOT EXISTS idx_lesson_reports_status ON public.lesson_reports(status);
CREATE INDEX IF NOT EXISTS idx_lesson_reports_created_at ON public.lesson_reports(created_at DESC);