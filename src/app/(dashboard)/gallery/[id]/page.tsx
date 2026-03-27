"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Grid, LayoutGrid, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import type { Project, GeneratedImage } from "@/types/database";

export default function GalleryPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [projectRes, imagesRes] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).single(),
        supabase.from("generated_images").select("*").eq("project_id", projectId).eq("status", "completed").order("created_at"),
      ]);
      if (projectRes.data) setProject(projectRes.data);
      if (imagesRes.data) setImages(imagesRes.data);
      setLoading(false);
    }
    load();
  }, [projectId]);

  const downloadAll = async () => {
    // In production, this would create a ZIP via an API route
    for (const img of images) {
      if (img.storage_path) {
        window.open(img.storage_path, "_blank");
      }
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground">Loading gallery...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/project/${projectId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{project?.name} — Gallery</h1>
            <p className="text-muted-foreground">{images.length} images</p>
          </div>
        </div>
        <Button onClick={downloadAll} className="gap-2" disabled={images.length === 0}>
          <Download className="h-4 w-4" />
          Download All
        </Button>
      </div>

      {/* Gallery Grid */}
      {images.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          No completed images yet. Go to the project page to generate images.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((img) => (
            <div
              key={img.id}
              className="group relative aspect-square rounded-xl overflow-hidden border border-border cursor-pointer bg-white"
              onClick={() => setSelectedImage(img)}
            >
              <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                {img.type.replace("_", " ")}
              </div>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="absolute bottom-2 left-2">
                <Badge variant="secondary" className="text-xs capitalize">
                  {img.type.replace("_", " ")}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {selectedImage && (
            <div className="relative">
              <div className="aspect-square bg-white flex items-center justify-center">
                <div className="text-muted-foreground">Full-size preview</div>
              </div>
              <div className="absolute bottom-4 right-4 flex gap-2">
                <Button size="sm" variant="secondary" className="gap-1">
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
