import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

export const MODELS = {
  // Background removal
  REMBG: 'cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003',
  // Image generation (product shots)
  FLUX_SCHNELL: 'black-forest-labs/flux-schnell',
  // High-quality image generation (model shots)
  FLUX_DEV: 'black-forest-labs/flux-dev',
  // Upscaling
  REAL_ESRGAN: 'nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa',
  // 3D reconstruction
  TRIPOSR: 'stability-ai/triposr:baabc06b9d3f0e3a2b3ce41be4e0e76df1b2e92ed36e6a56e24d684b6b8c36dc',
} as const;

export interface GenerationResult {
  success: boolean;
  output?: string | string[];
  error?: string;
  predictionId?: string;
}

// Remove background from image
export async function removeBackground(imageUrl: string): Promise<GenerationResult> {
  try {
    const output = await replicate.run(MODELS.REMBG, {
      input: { image: imageUrl },
    });
    return { success: true, output: output as unknown as string };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// Generate product shot (white background, clean)
export async function generateProductShot(
  imageUrl: string,
  jewelleryType: string
): Promise<GenerationResult> {
  try {
    const output = await replicate.run(MODELS.FLUX_SCHNELL, {
      input: {
        prompt: `Professional product photography of a ${jewelleryType}, centered on pure white background, studio lighting, high detail, commercial quality, clean and minimal, 4K`,
        image: imageUrl,
        num_outputs: 1,
        guidance_scale: 7.5,
      },
    });
    return { success: true, output: output as unknown as string[] };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// Generate model shot (jewellery on AI woman)
export async function generateModelShot(
  imageUrl: string,
  jewelleryType: string,
  placement: string
): Promise<GenerationResult> {
  const placementPrompts: Record<string, string> = {
    hand: 'elegant woman\'s hand wearing the jewellery, manicured nails, soft lighting',
    neck: 'beautiful woman wearing the necklace, bare décolletage, studio portrait',
    ear: 'close-up of woman\'s ear wearing the earring, hair pulled back, studio lighting',
    wrist: 'woman\'s wrist wearing the bracelet, elegant pose, soft lighting',
    finger: 'woman\'s hand with the ring, elegant pose, soft focus background',
  };

  try {
    const output = await replicate.run(MODELS.FLUX_DEV, {
      input: {
        prompt: `Professional fashion photography, ${placementPrompts[placement] || placementPrompts.hand}, photorealistic, high-end jewellery campaign, ${jewelleryType}, 4K, studio quality`,
        image: imageUrl,
        num_outputs: 1,
        guidance_scale: 7.5,
      },
    });
    return { success: true, output: output as unknown as string[] };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// Upscale image
export async function upscaleImage(imageUrl: string): Promise<GenerationResult> {
  try {
    const output = await replicate.run(MODELS.REAL_ESRGAN, {
      input: {
        image: imageUrl,
        scale: 4,
        face_enhance: false,
      },
    });
    return { success: true, output: output as unknown as string };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// Generate 3D model from images
export async function generate3DModel(imageUrl: string): Promise<GenerationResult> {
  try {
    const output = await replicate.run(MODELS.TRIPOSR, {
      input: {
        image: imageUrl,
        output_format: 'glb',
      },
    });
    return { success: true, output: output as unknown as string };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// Create prediction (async, for webhook-based flow)
export async function createPrediction(
  model: string,
  input: Record<string, unknown>,
  webhookUrl: string
) {
  const [owner, name] = model.split('/');
  const prediction = await replicate.predictions.create({
    model: `${owner}/${name}`,
    input,
    webhook: webhookUrl,
    webhook_events_filter: ['completed'],
  });
  return prediction;
}

export { replicate };
