
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS evidence_strength text,
  ADD COLUMN IF NOT EXISTS model_name text,
  ADD COLUMN IF NOT EXISTS model_version text,
  ADD COLUMN IF NOT EXISTS processing_ms integer,
  ADD COLUMN IF NOT EXISTS result jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.analyses
  ALTER COLUMN confidence_score DROP NOT NULL,
  ALTER COLUMN credibility_score DROP NOT NULL,
  ALTER COLUMN manipulation_score DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.detection_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS detection_usage_user_time_idx ON public.detection_usage (user_id, created_at DESC);
GRANT SELECT ON public.detection_usage TO authenticated;
GRANT ALL ON public.detection_usage TO service_role;
ALTER TABLE public.detection_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own usage" ON public.detection_usage;
CREATE POLICY "Users read own usage" ON public.detection_usage
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.model_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name text NOT NULL,
  model_version text NOT NULL,
  dataset_name text NOT NULL,
  dataset_size integer NOT NULL,
  accuracy numeric,
  precision_score numeric,
  recall numeric,
  f1_score numeric,
  false_positive_rate numeric,
  false_negative_rate numeric,
  roc_auc numeric,
  notes text,
  evaluated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.model_evaluations TO authenticated;
GRANT SELECT ON public.model_evaluations TO anon;
GRANT ALL ON public.model_evaluations TO service_role;
ALTER TABLE public.model_evaluations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read model evaluations" ON public.model_evaluations;
CREATE POLICY "Anyone can read model evaluations" ON public.model_evaluations
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage model evaluations" ON public.model_evaluations;
CREATE POLICY "Admins manage model evaluations" ON public.model_evaluations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
