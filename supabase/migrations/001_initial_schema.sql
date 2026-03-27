-- GemLens: AI Jewellery Photography Platform
-- Initial Schema

-- Custom types
CREATE TYPE jewellery_type AS ENUM ('ring', 'necklace', 'earring', 'bracelet', 'watch', 'pendant', 'brooch');
CREATE TYPE generation_type AS ENUM ('product_shot', 'model_shot', '3d_model');
CREATE TYPE model_placement AS ENUM ('hand', 'neck', 'ear', 'wrist', 'finger');
CREATE TYPE generation_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE project_status AS ENUM ('draft', 'processing', 'completed');
CREATE TYPE plan_tier AS ENUM ('free', 'starter', 'pro', 'enterprise');
CREATE TYPE lighting_preset AS ENUM ('neutral', 'studio', 'warm', 'cool');

-- Users (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  store_name TEXT,
  credits_remaining INTEGER NOT NULL DEFAULT 5,  -- 5 free credits on signup
  plan_tier plan_tier NOT NULL DEFAULT 'free',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create user row on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, store_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'store_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Credit packs
CREATE TABLE credit_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  credits INTEGER NOT NULL,
  price_usd NUMERIC(10,2) NOT NULL,
  popular BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed credit packs
INSERT INTO credit_packs (name, credits, price_usd, popular) VALUES
  ('Starter', 10, 15.00, FALSE),
  ('Pro', 50, 60.00, TRUE),
  ('Studio', 200, 200.00, FALSE);

-- Purchases
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pack_id UUID REFERENCES credit_packs(id),
  stripe_session_id TEXT,
  credits_added INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  jewellery_type jewellery_type NOT NULL DEFAULT 'ring',
  status project_status NOT NULL DEFAULT 'draft',
  source_image_count INTEGER NOT NULL DEFAULT 0,
  generated_image_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Source images
CREATE TABLE source_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  file_size INTEGER NOT NULL DEFAULT 0,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Generated images
CREATE TABLE generated_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type generation_type NOT NULL,
  storage_path TEXT NOT NULL DEFAULT '',
  model_placement model_placement,
  prompt_used TEXT,
  replicate_prediction_id TEXT,
  status generation_status NOT NULL DEFAULT 'pending',
  credits_cost INTEGER NOT NULL DEFAULT 1,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Generation queue (for async processing)
CREATE TABLE generation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type generation_type NOT NULL,
  status generation_status NOT NULL DEFAULT 'pending',
  replicate_prediction_id TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Embed configs (for 3D viewer embeds)
CREATE TABLE embed_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bg_color TEXT NOT NULL DEFAULT '#ffffff',
  autorotate BOOLEAN NOT NULL DEFAULT TRUE,
  autorotate_speed NUMERIC(5,2) NOT NULL DEFAULT 30.0,
  lighting_preset lighting_preset NOT NULL DEFAULT 'neutral',
  public_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_source_images_project ON source_images(project_id);
CREATE INDEX idx_generated_images_project ON generated_images(project_id);
CREATE INDEX idx_generated_images_status ON generated_images(status);
CREATE INDEX idx_generation_queue_status ON generation_queue(status);
CREATE INDEX idx_embed_configs_token ON embed_configs(public_token);
CREATE INDEX idx_purchases_user ON purchases(user_id);

-- RLS Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE embed_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_packs ENABLE ROW LEVEL SECURITY;

-- Users: own row only
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Projects: own projects only
CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create projects" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON projects FOR DELETE USING (auth.uid() = user_id);

-- Source images: via project ownership
CREATE POLICY "Users can view own source images" ON source_images FOR SELECT
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = source_images.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can upload source images" ON source_images FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = source_images.project_id AND projects.user_id = auth.uid()));

-- Generated images: via project ownership
CREATE POLICY "Users can view own generated images" ON generated_images FOR SELECT
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = generated_images.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can create generated images" ON generated_images FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = generated_images.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can update own generated images" ON generated_images FOR UPDATE
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = generated_images.project_id AND projects.user_id = auth.uid()));

-- Purchases: own only
CREATE POLICY "Users can view own purchases" ON purchases FOR SELECT USING (auth.uid() = user_id);

-- Credit packs: public read
CREATE POLICY "Anyone can view credit packs" ON credit_packs FOR SELECT USING (active = true);

-- Embed configs: own only (but public access via API route)
CREATE POLICY "Users can manage own embed configs" ON embed_configs FOR ALL USING (auth.uid() = user_id);

-- Storage buckets (run in Supabase dashboard or via supabase CLI)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('raw-uploads', 'raw-uploads', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('generated', 'generated', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('3d-models', '3d-models', true);
