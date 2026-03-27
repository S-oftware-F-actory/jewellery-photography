import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  removeBackground,
  generateProductShot,
  generateModelShot,
  generate3DModel,
  upscaleImage,
} from "@/lib/replicate";
import type { GenerationType, JewelleryType, ModelPlacement } from "@/types/database";

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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, type } = (await request.json()) as {
      projectId: string;
      type: GenerationType;
    };

    // Check credits
    const { data: userData } = await supabase
      .from("users")
      .select("credits_remaining")
      .eq("id", user.id)
      .single();

    const cost = CREDIT_COSTS[type];
    if (!userData || userData.credits_remaining < cost) {
      return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
    }

    // Get project with source images
    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { data: sourceImages } = await supabase
      .from("source_images")
      .select("*")
      .eq("project_id", projectId)
      .order("order")
      .limit(1);

    if (!sourceImages || sourceImages.length === 0) {
      return NextResponse.json({ error: "No source images" }, { status: 400 });
    }

    // Get signed URL for first source image
    const { data: signedUrl } = await supabase.storage
      .from("raw-uploads")
      .createSignedUrl(sourceImages[0].storage_path, 3600);

    if (!signedUrl?.signedUrl) {
      return NextResponse.json({ error: "Failed to access source image" }, { status: 500 });
    }

    const imageUrl = signedUrl.signedUrl;

    // Create generation record
    const { data: generation, error: genError } = await supabase
      .from("generated_images")
      .insert({
        project_id: projectId,
        type,
        storage_path: "",
        status: "processing",
        credits_cost: cost,
        model_placement: type === "model_shot"
          ? (JEWELLERY_PLACEMENTS[project.jewellery_type as JewelleryType]?.[0] || "hand")
          : null,
      })
      .select()
      .single();

    if (genError) throw genError;

    // Deduct credits
    await supabase
      .from("users")
      .update({ credits_remaining: userData.credits_remaining - cost })
      .eq("id", user.id);

    // Run AI pipeline (async — in production, use webhooks)
    let result;
    switch (type) {
      case "product_shot": {
        // Step 1: Remove background
        const bgRemoved = await removeBackground(imageUrl);
        if (!bgRemoved.success) throw new Error(bgRemoved.error);

        // Step 2: Generate product shot
        result = await generateProductShot(
          bgRemoved.output as string,
          project.jewellery_type
        );
        break;
      }
      case "model_shot": {
        const bgRemoved = await removeBackground(imageUrl);
        if (!bgRemoved.success) throw new Error(bgRemoved.error);

        const placement = JEWELLERY_PLACEMENTS[project.jewellery_type as JewelleryType]?.[0] || "hand";
        result = await generateModelShot(
          bgRemoved.output as string,
          project.jewellery_type,
          placement
        );
        break;
      }
      case "3d_model": {
        result = await generate3DModel(imageUrl);
        break;
      }
    }

    if (!result?.success) {
      // Refund credits on failure
      await supabase
        .from("users")
        .update({ credits_remaining: userData.credits_remaining })
        .eq("id", user.id);

      await supabase
        .from("generated_images")
        .update({ status: "failed" })
        .eq("id", generation.id);

      return NextResponse.json({ error: result?.error || "Generation failed" }, { status: 500 });
    }

    // Store result
    const outputUrl = Array.isArray(result.output) ? result.output[0] : result.output;

    // Update generation record
    await supabase
      .from("generated_images")
      .update({
        status: "completed",
        storage_path: outputUrl || "",
      })
      .eq("id", generation.id);

    // Update project counts
    await supabase
      .from("projects")
      .update({
        generated_image_count: (project.generated_image_count || 0) + 1,
        status: "completed",
      })
      .eq("id", projectId);

    return NextResponse.json({
      success: true,
      generationId: generation.id,
      outputUrl,
    });
  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
