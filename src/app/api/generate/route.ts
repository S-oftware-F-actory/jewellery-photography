import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPrediction, MODELS } from "@/lib/replicate";
import { createLogger } from "@/lib/logging";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import type { GenerationType, JewelleryType, ModelPlacement } from "@/types/database";

const log = createLogger("/api/generate");

const JEWELLERY_PLACEMENTS: Record<JewelleryType, ModelPlacement[]> = {
  ring: ["finger", "hand"],
  necklace: ["neck"],
  earring: ["ear"],
  bracelet: ["wrist"],
  watch: ["wrist"],
  pendant: ["neck"],
  brooch: ["neck"],
};

const CREDIT_COSTS: Record<GenerationType, number> = {
  product_shot: 1,
  model_shot: 2,
  "3d_model": 5,
};

// Pipeline step definitions for progress tracking
const PIPELINE_STEPS: Record<GenerationType, { total: number; labels: string[] }> = {
  product_shot: {
    total: 4,
    labels: [
      "Removing background...",
      "Generating product shot...",
      "Enhancing quality...",
      "Saving to gallery...",
    ],
  },
  model_shot: {
    total: 4,
    labels: [
      "Removing background...",
      "Generating model shot...",
      "Enhancing quality...",
      "Saving to gallery...",
    ],
  },
  "3d_model": {
    total: 2,
    labels: [
      "Reconstructing 3D model...",
      "Saving to gallery...",
    ],
  },
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      log.warn("Unauthorized request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userLog = log.withContext({ userId: user.id });

    // Rate limit check
    const rl = checkRateLimit(`generate:${user.id}`, RATE_LIMITS.generate);
    if (!rl.allowed) {
      userLog.warn("Rate limited", { remaining: rl.remaining, resetAt: rl.resetAt });
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
            "X-RateLimit-Limit": String(rl.limit),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    const body = await request.json();
    const { projectId, type } = body as {
      projectId: string;
      type: GenerationType;
    };

    // Validate generation type
    const cost = CREDIT_COSTS[type];
    if (cost === undefined) {
      userLog.warn("Invalid generation type", { type });
      return NextResponse.json({ error: "Invalid generation type" }, { status: 400 });
    }

    userLog.info("Starting generation", { projectId, type, cost });

    // Atomic credit deduction — prevents race conditions
    const { data: deducted, error: deductError } = await supabase.rpc(
      "deduct_credits",
      { p_user_id: user.id, p_amount: cost }
    );

    if (deductError || !deducted) {
      userLog.warn("Insufficient credits", { cost });
      return NextResponse.json(
        { error: "Insufficient credits" },
        { status: 402 }
      );
    }

    // Get project (ownership check via RLS)
    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (!project) {
      userLog.warn("Project not found, refunding credits", { projectId, cost });
      await supabase.rpc("add_credits", {
        p_user_id: user.id,
        p_amount: cost,
      });
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get source images
    const { data: sourceImages } = await supabase
      .from("source_images")
      .select("*")
      .eq("project_id", projectId)
      .order("order")
      .limit(1);

    if (!sourceImages || sourceImages.length === 0) {
      userLog.warn("No source images, refunding credits", { projectId, cost });
      await supabase.rpc("add_credits", {
        p_user_id: user.id,
        p_amount: cost,
      });
      return NextResponse.json({ error: "No source images" }, { status: 400 });
    }

    // Get signed URL for source image
    const { data: signedUrl } = await supabase.storage
      .from("raw-uploads")
      .createSignedUrl(sourceImages[0].storage_path, 3600);

    if (!signedUrl?.signedUrl) {
      userLog.error("Failed to create signed URL for source image", null, { projectId });
      await supabase.rpc("add_credits", {
        p_user_id: user.id,
        p_amount: cost,
      });
      return NextResponse.json(
        { error: "Something went wrong" },
        { status: 500 }
      );
    }

    const imageUrl = signedUrl.signedUrl;
    const placement =
      type === "model_shot"
        ? JEWELLERY_PLACEMENTS[project.jewellery_type as JewelleryType]?.[0] ||
          "hand"
        : null;

    const steps = PIPELINE_STEPS[type];

    // Create generation queue entry with step tracking
    const { data: queueEntry, error: queueError } = await supabase
      .from("generation_queue")
      .insert({
        project_id: projectId,
        type,
        status: "pending",
        current_step: 1,
        current_step_label: steps.labels[0],
        total_steps: steps.total,
      })
      .select()
      .single();

    if (queueError) {
      userLog.error("Queue insert failed", queueError, { projectId });
      await supabase.rpc("add_credits", {
        p_user_id: user.id,
        p_amount: cost,
      });
      return NextResponse.json(
        { error: "Something went wrong" },
        { status: 500 }
      );
    }

    // Create generated_images record
    const { data: generation, error: genError } = await supabase
      .from("generated_images")
      .insert({
        project_id: projectId,
        type,
        storage_path: "",
        status: "processing",
        credits_cost: cost,
        model_placement: placement,
      })
      .select()
      .single();

    if (genError) {
      userLog.error("Image record insert failed", genError, { projectId });
      await supabase.rpc("add_credits", {
        p_user_id: user.id,
        p_amount: cost,
      });
      return NextResponse.json(
        { error: "Something went wrong" },
        { status: 500 }
      );
    }

    // Build webhook URL with metadata
    const webhookUrl = new URL("/api/webhook", process.env.NEXT_PUBLIC_APP_URL!);
    webhookUrl.searchParams.set("queue_id", queueEntry.id);
    webhookUrl.searchParams.set("generation_id", generation.id);
    webhookUrl.searchParams.set("project_id", projectId);
    webhookUrl.searchParams.set("type", type);
    webhookUrl.searchParams.set("user_id", user.id);
    webhookUrl.searchParams.set("credits_cost", String(cost));
    if (placement) webhookUrl.searchParams.set("placement", placement);

    // Determine which model and input to use for step 1
    let model: string;
    let input: Record<string, unknown>;

    switch (type) {
      case "product_shot":
      case "model_shot":
        // Step 1 for both: remove background first
        model = MODELS.REMBG;
        input = { image: imageUrl };
        break;
      case "3d_model":
        model = MODELS.TRIPOSR;
        input = { image: imageUrl, output_format: "glb" };
        break;
      default:
        model = MODELS.REMBG;
        input = { image: imageUrl };
    }

    // Create async prediction on Replicate
    try {
      const prediction = await createPrediction(
        model,
        input,
        webhookUrl.toString()
      );

      // Update queue with prediction ID
      await supabase
        .from("generation_queue")
        .update({
          status: "processing",
          replicate_prediction_id: prediction.id,
          started_at: new Date().toISOString(),
        })
        .eq("id", queueEntry.id);

      // Update generation record with prediction ID
      await supabase
        .from("generated_images")
        .update({ replicate_prediction_id: prediction.id })
        .eq("id", generation.id);

      userLog.info("Generation started", {
        projectId,
        type,
        predictionId: prediction.id,
        queueId: queueEntry.id,
      });

      return NextResponse.json(
        {
          success: true,
          queueId: queueEntry.id,
          generationId: generation.id,
          predictionId: prediction.id,
        },
        { status: 202 }
      );
    } catch (predictionError) {
      userLog.error("Replicate prediction failed", predictionError, { projectId, type });

      // Refund credits on prediction creation failure
      await supabase.rpc("add_credits", {
        p_user_id: user.id,
        p_amount: cost,
      });

      await supabase
        .from("generated_images")
        .update({ status: "failed" })
        .eq("id", generation.id);

      await supabase
        .from("generation_queue")
        .update({
          status: "failed",
          error:
            predictionError instanceof Error
              ? predictionError.message
              : "Prediction creation failed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", queueEntry.id);

      return NextResponse.json(
        { error: "Something went wrong" },
        { status: 500 }
      );
    }
  } catch (error) {
    log.error("Unexpected error", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
