"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { Upload, X, Diamond, Loader2, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { JewelleryType } from "@/types/database";

const jewelleryTypes: { value: JewelleryType; label: string; emoji: string }[] = [
  { value: "ring", label: "Ring", emoji: "💍" },
  { value: "necklace", label: "Necklace", emoji: "📿" },
  { value: "earring", label: "Earrings", emoji: "✨" },
  { value: "bracelet", label: "Bracelet", emoji: "⌚" },
  { value: "watch", label: "Watch", emoji: "⌚" },
  { value: "pendant", label: "Pendant", emoji: "🔮" },
  { value: "brooch", label: "Brooch", emoji: "🪻" },
];

export default function NewProjectPage() {
  const [name, setName] = useState("");
  const [type, setType] = useState<JewelleryType>("ring");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const totalFiles = files.length + acceptedFiles.length;
    if (totalFiles > 8) {
      setError("Maximum 8 images allowed");
      return;
    }
    setError(null);
    const newFiles = [...files, ...acceptedFiles];
    setFiles(newFiles);

    const newPreviews = acceptedFiles.map((file) => URL.createObjectURL(file));
    setPreviews((prev) => [...prev, ...newPreviews]);
  }, [files]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    maxSize: 20 * 1024 * 1024, // 20MB
  });

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length < 3) {
      setError("Please upload at least 3 images");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create project
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          name,
          jewellery_type: type,
          status: "draft",
          source_image_count: files.length,
          generated_image_count: 0,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Upload images
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${project.id}/${i}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("raw-uploads")
          .upload(path, file);

        if (uploadError) throw uploadError;

        // Record source image
        await supabase.from("source_images").insert({
          project_id: project.id,
          storage_path: path,
          file_name: file.name,
          file_size: file.size,
          order: i,
        });
      }

      router.push(`/project/${project.id}`);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Project</h1>
        <p className="text-muted-foreground">Upload photos of your jewellery piece to get started</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Project Info */}
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>Name your project and select the jewellery type</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                placeholder="e.g., Spring 2025 Collection - Diamond Rings"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Jewellery Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as JewelleryType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {jewelleryTypes.map((jt) => (
                    <SelectItem key={jt.value} value={jt.value}>
                      {jt.emoji} {jt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Upload */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Photos</CardTitle>
            <CardDescription>
              Upload 3-8 photos of the piece from different angles. More angles = better results.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">
                {isDragActive ? "Drop images here..." : "Drag & drop images, or click to browse"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                JPG, PNG, WebP — max 20MB each — 3 to 8 images
              </p>
            </div>

            {/* Preview Grid */}
            {previews.length > 0 && (
              <div className="grid grid-cols-4 gap-3">
                {previews.map((preview, index) => (
                  <div key={index} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                    <img
                      src={preview}
                      alt={`Upload ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px]">
                      {index + 1}
                    </div>
                  </div>
                ))}
                {files.length < 8 && (
                  <div
                    {...getRootProps()}
                    className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    <input {...getInputProps()} />
                    <ImagePlus className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              {files.length}/8 images uploaded
              {files.length < 3 && " (minimum 3 required)"}
            </div>
          </CardContent>
        </Card>

        <Button
          type="submit"
          size="lg"
          className="w-full gap-2"
          disabled={loading || files.length < 3}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating project...
            </>
          ) : (
            <>
              <Diamond className="h-4 w-4" />
              Create Project
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
