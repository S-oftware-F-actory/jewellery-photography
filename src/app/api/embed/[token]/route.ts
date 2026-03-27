import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Public endpoint — uses service role to fetch embed config
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: config } = await supabase
    .from("embed_configs")
    .select("*, projects(name, jewellery_type)")
    .eq("public_token", token)
    .single();

  if (!config) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Find the 3D model for this project
  const { data: model3d } = await supabase
    .from("generated_images")
    .select("storage_path")
    .eq("project_id", config.project_id)
    .eq("type", "3d_model")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!model3d) {
    return NextResponse.json({ error: "No 3D model available" }, { status: 404 });
  }

  return NextResponse.json({
    modelUrl: model3d.storage_path,
    config: {
      bgColor: config.bg_color,
      autorotate: config.autorotate,
      autorotateSpeed: config.autorotate_speed,
      lightingPreset: config.lighting_preset,
    },
    project: {
      name: config.projects?.name,
      type: config.projects?.jewellery_type,
    },
  });
}
