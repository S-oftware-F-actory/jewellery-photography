import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPrediction, MODELS } from "@/lib/replicate";
import type { GenerationType, JewelleryType } from "@/types/database";

// Pipeline step labels for each generation type
const STEP_LABELS: Record<GenerationType, string[]> = {
  product_shot: [
    "Removing background...",
    "Generating product shot...",
    "Enhancing quality...",
    "Saving to gallery...",
  ],
  model_shot: [
    "Removing background...",
    "Generating model shot...",
    "Enhancing quality...",
    "Saving to gallery...",
  ],
  "3d_model": [
    "Reconstructing 3D model...",
    "Saving to gallery...",
  ],
};

const PLACEMENT_PROMPTS: Record<string, string> = {
  hand: "elegant woman's hand wearing the jewellery, manicured nails, soft lighting",
  neck: "beautiful woman wearing the necklace, studio portrait",
  ear: "close-up of woman's ear wearing the earring, hair pulled back, studio lighting",
  wrist: "woman's wrist wearing the bracelet, elegant pose, soft lighting",
  finger: "woman's hand with the ring, elegant pose, soft focus background",
};

/**
 * Webhook handler for Replicate prediction completions.
 *
 * Multi-step pipeline: each completed prediction may trigger the next step.
 * Step 1 (bg removal) -> Step 2 (generation) -> Step 3 (upscale) -> Step 4 (save)
 *
 * For 3D models: Step 1 (reconstruction) -> Step 2 (save)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Replicate webhook payload
    const { status, output, error: predictionError } = body;
    const queueId = request.nextUrl.searchParams.get("queue_id");
    const generationId = request.nextUrl.searchParams.get("generation_id");
    const projectId = request.nextUrl.searchParams.get("project_id");
    const type = request.nextUrl.searchParams.get("type") as GenerationType;
    const userId = request.nextUrl.searchParams.get("user_id");
    const creditsCost = parseInt(
      request.nextUrl.searchParams.get("credits_cost") || "0"
    );
    const placement = request.nextUrl.searchParams.get("placement");
    const step = parseInt(
      request.nextUrl.searchParams.get("step") || "1"
    );

    if (!queueId || !generationId || !projectId || !type || !userId) {
      console.error("[webhook] Missing required params");
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const labels = STEP_LABELS[type];

    // Handle failed prediction
    if (status === "failed") {
      console.error(
        `[webhook] Prediction failed for queue ${queueId}:`,
        predictionError
      );

      await supabase.rpc("add_credits", {
        p_user_id: userId,
        p_amount: creditsCost,
      });

      await supabase
        .from("generation_queue")
        .update({
          status: "failed",
          error: predictionError || "Generation failed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", queueId);

      await supabase
        .from("generated_images")
        .update({ status: "failed" })
        .eq("id", generationId);

      return NextResponse.json({ ok: true });
    }

    if (status !== "succeeded") {
      // Ignore non-terminal statuses
      return NextResponse.json({ ok: true });
    }

    // Extract output URL
    const outputUrl = Array.isArray(output) ? output[0] : output;
    if (!outputUrl) {
      console.error("[webhook] Empty output for queue", queueId);

      await supabase.rpc("add_credits", {
        p_user_id: userId,
        p_amount: creditsCost,
      });

      await supabase
        .from("generation_queue")
        .update({
          status: "failed",
          error: "Empty output from AI model",
          completed_at: new Date().toISOString(),
        })
        .eq("id", queueId);

      await supabase
        .from("generated_images")
        .update({ status: "failed" })
        .eq("id", generationId);

      return NextResponse.json({ ok: true });
    }

    console.log(
      `[webhook] Step ${step} completed for queue ${queueId}, type ${type}`
    );

    // Determine next action based on type and current step
    const totalSteps = labels.length;

    if (step < totalSteps - 1) {
      // More pipeline steps to run — trigger next prediction
      const nextStep = step + 1;

      // Update progress
      await supabase
        .from("generation_queue")
        .update({
          current_step: nextStep,
          current_step_label: labels[nextStep - 1],
        })
        .eq("id", queueId);

      // Build webhook URL for next step
      const webhookUrl = new URL(
        "/api/webhook",
        process.env.NEXT_PUBLIC_APP_URL!
      );
      webhookUrl.searchParams.set("queue_id", queueId);
      webhookUrl.searchParams.set("generation_id", generationId);
      webhookUrl.searchParams.set("project_id", projectId);
      webhookUrl.searchParams.set("type", type);
      webhookUrl.searchParams.set("user_id", userId);
      webhookUrl.searchParams.set("credits_cost", String(creditsCost));
      webhookUrl.searchParams.set("step", String(nextStep));
      if (placement) webhookUrl.searchParams.set("placement", placement);

      // Get the project for jewellery type info
      const { data: project } = await supabase
        .from("projects")
        .select("jewellery_type")
        .eq("id", projectId)
        .single();

      const jewelleryType = project?.jewellery_type || "ring";

      // Determine which model to run next
      let model: string;
      let input: Record<string, unknown>;

      if (type === "product_shot" && step === 1) {
        // Step 1 done (bg removed) -> Step 2: generate product shot
        model = MODELS.FLUX_SCHNELL;
        input = {
          prompt: `Professional product photography of a ${jewelleryType}, centered on pure white background, studio lighting, high detail, commercial quality, clean and minimal, 4K`,
          image: outputUrl,
          num_outputs: 1,
          guidance_scale: 7.5,
        };
      } else if (type === "model_shot" && step === 1) {
        // Step 1 done (bg removed) -> Step 2: generate model shot
        const p = placement || "hand";
        model = MODELS.FLUX_DEV;
        input = {
          prompt: `Professional fashion photography, ${PLACEMENT_PROMPTS[p] || PLACEMENT_PROMPTS.hand}, photorealistic, high-end jewellery campaign, ${jewelleryType}, 4K, studio quality`,
          image: outputUrl,
          num_outputs: 1,
          guidance_scale: 7.5,
        };
      } else if (
        (type === "product_shot" || type === "model_shot") &&
        step === 2
      ) {
        // Step 2 done (generated) -> Step 3: upscale
        model = MODELS.REAL_ESRGAN;
        input = {
          image: outputUrl,
          scale: 4,
          face_enhance: false,
        };
      } else {
        // Shouldn't reach here, but fall through to save
        await saveOutput(
          supabase,
          outputUrl,
          queueId,
          generationId,
          projectId,
          type,
          labels
        );
        return NextResponse.json({ ok: true });
      }

      const prediction = await createPrediction(
        model,
        input,
        webhookUrl.toString()
      );

      await supabase
        .from("generation_queue")
        .update({ replicate_prediction_id: prediction.id })
        .eq("id", queueId);

      console.log(
        `[webhook] Triggered step ${nextStep} for queue ${queueId}, prediction ${prediction.id}`
      );

      return NextResponse.json({ ok: true });
    }

    // Final step — save the output to persistent storage
    await saveOutput(
      supabase,
      outputUrl,
      queueId,
      generationId,
      projectId,
      type,
      labels
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[webhook] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}

async function saveOutput(
  supabase: ReturnType<typeof createAdminClient>,
  outputUrl: string,
  queueId: string,
  generationId: string,
  projectId: string,
  type: GenerationType,
  labels: string[]
) {
  // Update progress to final step
  await supabase
    .from("generation_queue")
    .update({
      current_step: labels.length,
      current_step_label: labels[labels.length - 1],
    })
    .eq("id", queueId);

  // Download the output from Replicate and store in Supabase Storage
  const bucket = type === "3d_model" ? "3d-models" : "generated";
  const ext = type === "3d_model" ? "glb" : "png";
  const storagePath = `${projectId}/${generationId}.${ext}`;

  try {
    const response = await fetch(outputUrl);
    if (!response.ok) throw new Error(`Failed to download: ${response.status}`);

    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType: type === "3d_model" ? "model/gltf-binary" : "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("[webhook] Storage upload failed:", uploadError);
      // Still save the temporary URL as fallback
    }
  } catch (downloadError) {
    console.error("[webhook] Output download failed:", downloadError);
    // Save the temporary Replicate URL as fallback
  }

  // Get the public/signed URL for the stored file
  let persistentUrl = outputUrl; // fallback to Replicate URL
  if (type === "3d_model") {
    // 3D models bucket is public
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    persistentUrl = publicUrl;
  } else {
    // Generated images bucket is private — use signed URL (7 days)
    const { data: signed } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 604800);
    if (signed?.signedUrl) persistentUrl = signed.signedUrl;
  }

  // Update generation record with persistent storage path
  await supabase
    .from("generated_images")
    .update({
      status: "completed",
      storage_path: storagePath,
    })
    .eq("id", generationId);

  // Update queue as completed
  await supabase
    .from("generation_queue")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", queueId);

  // Increment project generated count
  await supabase.rpc("increment_generated_count", {
    p_project_id: projectId,
  });

  console.log(
    `[webhook] Saved ${type} output for generation ${generationId} at ${storagePath}`
  );
}
