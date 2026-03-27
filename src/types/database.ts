export type JewelleryType = 'ring' | 'necklace' | 'earring' | 'bracelet' | 'watch' | 'pendant' | 'brooch';
export type GenerationType = 'product_shot' | 'model_shot' | '3d_model';
export type ModelPlacement = 'hand' | 'neck' | 'ear' | 'wrist' | 'finger';
export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ProjectStatus = 'draft' | 'processing' | 'completed';
export type PlanTier = 'free' | 'starter' | 'pro' | 'enterprise';

export interface User {
  id: string;
  email: string;
  name: string | null;
  store_name: string | null;
  credits_remaining: number;
  credits_expires_at: string | null;
  plan_tier: PlanTier;
  avatar_url: string | null;
  created_at: string;
}

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price_usd: number;
  popular: boolean;
  active: boolean;
  created_at: string;
}

export interface Purchase {
  id: string;
  user_id: string;
  pack_id: string;
  stripe_session_id: string | null;
  credits_added: number;
  created_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  jewellery_type: JewelleryType;
  status: ProjectStatus;
  source_image_count: number;
  generated_image_count: number;
  created_at: string;
  updated_at: string;
}

export interface SourceImage {
  id: string;
  project_id: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  order: number;
  created_at: string;
}

export interface GeneratedImage {
  id: string;
  project_id: string;
  type: GenerationType;
  storage_path: string;
  model_placement: ModelPlacement | null;
  prompt_used: string | null;
  replicate_prediction_id: string | null;
  status: GenerationStatus;
  credits_cost: number;
  width: number | null;
  height: number | null;
  created_at: string;
}

export interface GenerationJob {
  id: string;
  project_id: string;
  type: GenerationType;
  status: GenerationStatus;
  current_step: number;
  current_step_label: string;
  total_steps: number;
  replicate_prediction_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  created_at: string;
}

export interface EmbedConfig {
  id: string;
  project_id: string;
  user_id: string;
  bg_color: string;
  autorotate: boolean;
  autorotate_speed: number;
  lighting_preset: 'neutral' | 'studio' | 'warm' | 'cool';
  public_token: string;
  created_at: string;
}
