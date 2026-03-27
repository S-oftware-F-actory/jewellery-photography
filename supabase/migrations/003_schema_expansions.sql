-- Phase 2: Schema Expansions
-- Adds brand_kits, export_presets, ar_sessions tables for Phases 5-6 features

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE watermark_position AS ENUM (
  'top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'
);

CREATE TYPE export_platform AS ENUM (
  'instagram', 'pinterest', 'facebook', 'whatsapp', 'custom'
);

CREATE TYPE export_format AS ENUM (
  'png', 'jpg', 'webp'
);

-- ============================================================================
-- BRAND KITS — one per user (logo, colors, watermark settings)
-- ============================================================================

CREATE TABLE brand_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  logo_path TEXT,
  primary_color TEXT NOT NULL DEFAULT '#000000',
  secondary_color TEXT NOT NULL DEFAULT '#ffffff',
  watermark_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  watermark_position watermark_position NOT NULL DEFAULT 'bottom-right',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One brand kit per user
CREATE UNIQUE INDEX idx_brand_kits_user ON brand_kits(user_id);

ALTER TABLE brand_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own brand kit"
  ON brand_kits FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- EXPORT PRESETS — user-customized social media export presets
-- System defaults (Instagram 1:1, Pinterest 2:3, etc.) handled in app code
-- ============================================================================

CREATE TABLE export_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform export_platform NOT NULL,
  name TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  aspect_ratio TEXT NOT NULL,
  format export_format NOT NULL DEFAULT 'png',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_export_presets_user ON export_presets(user_id);

ALTER TABLE export_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own export presets"
  ON export_presets FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- AR SESSIONS — analytics tracking for AR try-on feature
-- ============================================================================

CREATE TABLE ar_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  jewellery_type jewellery_type NOT NULL,
  placement model_placement NOT NULL,
  duration_seconds INTEGER,
  device_info JSONB,
  status TEXT NOT NULL DEFAULT 'started'
    CHECK (status IN ('started', 'completed', 'failed', 'unsupported')),
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ar_sessions_user ON ar_sessions(user_id);
CREATE INDEX idx_ar_sessions_project ON ar_sessions(project_id);

ALTER TABLE ar_sessions ENABLE ROW LEVEL SECURITY;

-- No DELETE policy — AR sessions are analytics records
CREATE POLICY "Users can view own AR sessions"
  ON ar_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create AR sessions"
  ON ar_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own AR sessions"
  ON ar_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- STORAGE BUCKET (create via Supabase dashboard or CLI)
-- ============================================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('brand-assets', 'brand-assets', false);
