
CREATE TABLE public.elevenlabs_alert_config (
  id INT PRIMARY KEY DEFAULT 1,
  max_calls_per_month INT,
  max_cost_usd_per_month NUMERIC(10,2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CONSTRAINT singleton CHECK (id = 1)
);

INSERT INTO public.elevenlabs_alert_config (id, max_calls_per_month, max_cost_usd_per_month)
VALUES (1, 1000, 50.00);

ALTER TABLE public.elevenlabs_alert_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read alert config"
ON public.elevenlabs_alert_config FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update alert config"
ON public.elevenlabs_alert_config FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
