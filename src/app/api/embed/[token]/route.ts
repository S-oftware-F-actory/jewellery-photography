import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createLogger } from "@/lib/logging";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const log = createLogger("/api/embed");

// Public endpoint — uses service role to fetch embed config
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Rate limit by IP (public endpoint, no auth)
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = checkRateLimit(`embed:${ip}`, RATE_LIMITS.embed);
  if (!rl.allowed) {
    log.warn("Rate limited", { ip, token });
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    );
  }

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
    log.warn("Embed config not found", { token });
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
    log.warn("No 3D model for embed", { token, projectId: config.project_id });
    return NextResponse.json({ error: "No 3D model available" }, { status: 404 });
  }

  log.info("Embed config served", { token, projectId: config.project_id });

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
