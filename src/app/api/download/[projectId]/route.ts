import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import archiver from "archiver";
import { PassThrough } from "stream";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch project (RLS ensures ownership)
  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Fetch completed generated images
  const { data: images } = await supabase
    .from("generated_images")
    .select("id, type, storage_path")
    .eq("project_id", projectId)
    .eq("status", "completed");

  if (!images || images.length === 0) {
    return NextResponse.json({ error: "No images to download" }, { status: 404 });
  }

  // Create signed URLs for all images
  const paths = images.map((img) => img.storage_path);
  const { data: signedUrls } = await supabase.storage
    .from("generated")
    .createSignedUrls(paths, 300);

  if (!signedUrls) {
    return NextResponse.json({ error: "Failed to generate download URLs" }, { status: 500 });
  }

  const urlMap: Record<string, string> = {};
  for (const item of signedUrls) {
    if (item.signedUrl && item.path) {
      urlMap[item.path] = item.signedUrl;
    }
  }

  // Build ZIP using archiver
  const archive = archiver("zip", { zlib: { level: 5 } });
  const passThrough = new PassThrough();
  archive.pipe(passThrough);

  // Add each image to ZIP, organized by type
  const typeCounts: Record<string, number> = {};
  for (const img of images) {
    const url = urlMap[img.storage_path];
    if (!url) continue;

    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const buffer = Buffer.from(await response.arrayBuffer());

      const folder = img.type.replace("_", "-") + "s";
      typeCounts[folder] = (typeCounts[folder] || 0) + 1;
      const ext = img.type === "3d_model" ? "glb" : "png";
      const fileName = `${folder}/${typeCounts[folder]}.${ext}`;

      archive.append(buffer, { name: fileName });
    } catch {
      // Skip failed downloads
    }
  }

  archive.finalize();

  // Convert Node stream to Web ReadableStream
  const readable = new ReadableStream({
    start(controller) {
      passThrough.on("data", (chunk) => controller.enqueue(chunk));
      passThrough.on("end", () => controller.close());
      passThrough.on("error", (err) => controller.error(err));
    },
  });

  const safeName = project.name.replace(/[^a-zA-Z0-9-_]/g, "-");

  return new Response(readable, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeName}-images.zip"`,
    },
  });
}
