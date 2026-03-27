"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, ZoomIn, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { getSignedUrls, downloadImage } from "@/lib/storage";
import type { Project, GeneratedImage } from "@/types/database";

export default function GalleryPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [projectRes, imagesRes] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).single(),
        supabase.from("generated_images").select("*").eq("project_id", projectId).eq("status", "completed").order("created_at"),
      ]);
      if (projectRes.data) setProject(projectRes.data);
      if (imagesRes.data) {
        setImages(imagesRes.data);
        // Resolve signed URLs
        const paths = imagesRes.data.map((img) => img.storage_path);
        const urls = await getSignedUrls("generated", paths);
        setImageUrls(urls);
      }
      setLoading(false);
    }
    load();
  }, [projectId]);

  const downloadAll = async () => {
    setDownloading(true);
    try {
      const response = await fetch(`/api/download/${projectId}`);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project?.name || "gallery"}-images.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: download individually
      for (const img of images) {
        if (img.storage_path && imageUrls[img.storage_path]) {
          await downloadImage("generated", img.storage_path, `${img.type}-${img.id.slice(0, 8)}.png`);
        }
      }
    } finally {
      setDownloading(false);
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
        <Button onClick={downloadAll} className="gap-2" disabled={images.length === 0 || downloading}>
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {downloading ? "Preparing..." : "Download All"}
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
              {imageUrls[img.storage_path] ? (
                <img
                  src={imageUrls[img.storage_path]}
                  alt={img.type.replace("_", " ")}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                  Loading...
                </div>
              )}
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
              <div className="bg-white flex items-center justify-center min-h-[400px]">
                {imageUrls[selectedImage.storage_path] ? (
                  <img
                    src={imageUrls[selectedImage.storage_path]}
                    alt={selectedImage.type.replace("_", " ")}
                    className="w-full h-auto max-h-[80vh] object-contain"
                  />
                ) : (
                  <div className="text-muted-foreground">Loading...</div>
                )}
              </div>
              <div className="absolute bottom-4 right-4 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1"
                  onClick={() => downloadImage(
                    "generated",
                    selectedImage.storage_path,
                    `${selectedImage.type}-${selectedImage.id.slice(0, 8)}.png`
                  )}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
              </div>
              <div className="absolute top-4 left-4">
                <Badge variant="secondary" className="capitalize">
                  {selectedImage.type.replace("_", " ")}
                </Badge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
