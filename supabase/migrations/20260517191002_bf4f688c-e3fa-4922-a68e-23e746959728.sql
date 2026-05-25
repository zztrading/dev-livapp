CREATE INDEX IF NOT EXISTS idx_lessons_course_active_order
  ON public.lessons (course_id, order_index)
  WHERE is_active = true;