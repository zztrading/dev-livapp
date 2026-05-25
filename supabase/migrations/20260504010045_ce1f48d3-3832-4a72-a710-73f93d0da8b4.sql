-- Restrict system_logs INSERT to service_role only (currently public can insert anything)
DROP POLICY IF EXISTS "service_role_insert_logs" ON public.system_logs;

CREATE POLICY "service_role_insert_logs"
  ON public.system_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Enable leaked password protection at application level is configured separately
