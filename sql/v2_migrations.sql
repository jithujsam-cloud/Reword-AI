-- =============================================
-- Reword V2 Migrations
-- Tables: personas, feedback_log
-- =============================================

-- 1. PERSONAS TABLE
CREATE TABLE IF NOT EXISTS personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(supabase_user_id) ON DELETE CASCADE,
  name text NOT NULL,
  tone text NOT NULL DEFAULT 'Professional',
  training_samples text[] DEFAULT '{}',
  style_fingerprint jsonb DEFAULT NULL,
  avoidance_rules text[] DEFAULT '{}',
  is_default boolean DEFAULT false,
  total_rewrites integer DEFAULT 0,
  accepted_count integer DEFAULT 0,
  rejected_count integer DEFAULT 0,
  last_correction_at timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. FEEDBACK_LOG TABLE
CREATE TABLE IF NOT EXISTS feedback_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(supabase_user_id) ON DELETE CASCADE,
  persona_id uuid REFERENCES personas(id) ON DELETE SET NULL,
  original_text text NOT NULL,
  rewritten_text text NOT NULL,
  signal text NOT NULL CHECK (signal IN ('accepted', 'rejected')),
  created_at timestamptz DEFAULT now()
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_personas_user_id ON personas(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_log_user_id ON feedback_log(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_log_persona_id ON feedback_log(persona_id);
CREATE INDEX IF NOT EXISTS idx_feedback_log_signal ON feedback_log(signal);

-- 4. ROW LEVEL SECURITY

-- Personas RLS
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own personas"
  ON personas FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own personas"
  ON personas FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own personas"
  ON personas FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own personas"
  ON personas FOR DELETE
  USING (user_id = auth.uid());

-- Feedback Log RLS
ALTER TABLE feedback_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feedback"
  ON feedback_log FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own feedback"
  ON feedback_log FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own feedback"
  ON feedback_log FOR DELETE
  USING (user_id = auth.uid());

-- 5. HELPER: Ensure only one default persona per user
-- (Trigger to unset other defaults when one is set)
CREATE OR REPLACE FUNCTION enforce_single_default_persona()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE personas
    SET is_default = false, updated_at = now()
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_default ON personas;
CREATE TRIGGER trg_enforce_single_default
  BEFORE INSERT OR UPDATE OF is_default
  ON personas
  FOR EACH ROW
  EXECUTE FUNCTION enforce_single_default_persona();
