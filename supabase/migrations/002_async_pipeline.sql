-- Phase 1: Async pipeline support
-- Adds step tracking to generation_queue, atomic credit functions, project count helpers

-- Add step tracking columns to generation_queue
ALTER TABLE generation_queue
  ADD COLUMN IF NOT EXISTS current_step INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS current_step_label TEXT NOT NULL DEFAULT 'Starting...',
  ADD COLUMN IF NOT EXISTS total_steps INTEGER NOT NULL DEFAULT 1;

-- Add credits_expires_at to users (for future credit expiry)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS credits_expires_at TIMESTAMPTZ;

-- Atomic credit deduction: returns TRUE if successful, FALSE if insufficient
CREATE OR REPLACE FUNCTION deduct_credits(p_user_id UUID, p_amount INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  UPDATE users
  SET credits_remaining = credits_remaining - p_amount,
      updated_at = NOW()
  WHERE id = p_user_id
    AND credits_remaining >= p_amount;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add credits (for refunds and admin manual adjustments)
CREATE OR REPLACE FUNCTION add_credits(p_user_id UUID, p_amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET credits_remaining = credits_remaining + p_amount,
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment generated image count on project (atomic)
CREATE OR REPLACE FUNCTION increment_generated_count(p_project_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE projects
  SET generated_image_count = generated_image_count + 1,
      status = 'completed',
      updated_at = NOW()
  WHERE id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow webhook handler (service role) to manage generation_queue
-- generation_queue has no RLS enabled by default, so service role can access
-- But let's add RLS for user-facing reads
ALTER TABLE generation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own generation queue" ON generation_queue FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = generation_queue.project_id
    AND projects.user_id = auth.uid()
  ));

-- Service role bypasses RLS, so webhook handler can write freely

-- Index for queue lookups by project (for realtime subscriptions)
CREATE INDEX IF NOT EXISTS idx_generation_queue_project ON generation_queue(project_id);
