"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Camera, Sparkles, Box, Download, Loader2, RotateCcw, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/client";
import type { Project, SourceImage, GeneratedImage } from "@/types/database";

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [sourceImages, setSourceImages] = useState<SourceImage[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProject() {
      const supabase = createClient();

      const [projectRes, sourcesRes, generatedRes] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).single(),
        supabase.from("source_images").select("*").eq("project_id", projectId).order("order"),
        supabase.from("generated_images").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
      ]);

      if (projectRes.data) setProject(projectRes.data);
      if (sourcesRes.data) setSourceImages(sourcesRes.data);
      if (generatedRes.data) setGeneratedImages(generatedRes.data);
      setLoading(false);
    }
    loadProject();
  }, [projectId]);

  const triggerGeneration = async (type: "product_shot" | "model_shot" | "3d_model") => {
    setGenerating(type);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, type }),
      });

      if (!response.ok) throw new Error("Generation failed");

      // Reload generated images
      const supabase = createClient();
      const { data } = await supabase
        .from("generated_images")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (data) setGeneratedImages(data);
    } catch (error) {
      console.error("Generation error:", error);
    } finally {
      setGenerating(null);
    }
  };

  const productShots = generatedImages.filter((img) => img.type === "product_shot");
  const modelShots = generatedImages.filter((img) => img.type === "model_shot");
  const models3d = generatedImages.filter((img) => img.type === "3d_model");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-pulse text-muted-foreground">Loading project...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-24">
        <h2 className="text-xl font-semibold">Project not found</h2>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <Badge variant="outline" className="capitalize">{project.jewellery_type}</Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            {sourceImages.length} source images &middot; {generatedImages.length} generated
          </p>
        </div>
      </div>

      {/* Source Images */}
      <Card>
        <CardHeader>
          <CardTitle>Source Images</CardTitle>
          <CardDescription>Original photos uploaded for this piece</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
            {sourceImages.map((img, i) => (
              <div key={img.id} className="aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                  {img.file_name}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Generation Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => !generating && triggerGeneration("product_shot")}>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="rounded-full bg-primary/10 p-3">
              <Camera className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">Product Shots</div>
              <div className="text-sm text-muted-foreground">White background, studio quality</div>
            </div>
            {generating === "product_shot" ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <Badge>{productShots.length}</Badge>
            )}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => !generating && triggerGeneration("model_shot")}>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="rounded-full bg-primary/10 p-3">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">Model Shots</div>
              <div className="text-sm text-muted-foreground">Jewellery on AI models</div>
            </div>
            {generating === "model_shot" ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <Badge>{modelShots.length}</Badge>
            )}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => !generating && triggerGeneration("3d_model")}>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="rounded-full bg-primary/10 p-3">
              <Box className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">3D Model</div>
              <div className="text-sm text-muted-foreground">Interactive, embeddable viewer</div>
            </div>
            {generating === "3d_model" ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <Badge>{models3d.length}</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Generated Results */}
      {generatedImages.length > 0 && (
        <Tabs defaultValue="product" className="space-y-4">
          <TabsList>
            <TabsTrigger value="product">Product Shots ({productShots.length})</TabsTrigger>
            <TabsTrigger value="model">Model Shots ({modelShots.length})</TabsTrigger>
            <TabsTrigger value="3d">3D ({models3d.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="product">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {productShots.map((img) => (
                <Card key={img.id} className="overflow-hidden">
                  <div className="aspect-square bg-white flex items-center justify-center border-b">
                    <div className="text-sm text-muted-foreground">
                      {img.status === "completed" ? "Generated" : img.status}
                    </div>
                  </div>
                  <CardContent className="p-3 flex items-center justify-between">
                    <Badge variant={img.status === "completed" ? "default" : "secondary"}>
                      {img.status}
                    </Badge>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="model">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {modelShots.map((img) => (
                <Card key={img.id} className="overflow-hidden">
                  <div className="aspect-[3/4] bg-muted flex items-center justify-center border-b">
                    <div className="text-sm text-muted-foreground">
                      {img.model_placement} — {img.status}
                    </div>
                  </div>
                  <CardContent className="p-3 flex items-center justify-between">
                    <Badge variant={img.status === "completed" ? "default" : "secondary"}>
                      {img.model_placement}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Download className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="3d">
            {models3d.length > 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Box className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">3D Model Ready</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Your interactive 3D model has been generated
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <Button variant="outline" className="gap-2">
                      <Box className="h-4 w-4" /> View 3D
                    </Button>
                    <Button variant="outline" className="gap-2">
                      <Code className="h-4 w-4" /> Get Embed Code
                    </Button>
                    <Button variant="outline" className="gap-2">
                      <Download className="h-4 w-4" /> Download GLB
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-muted-foreground">
                  No 3D models generated yet. Click &ldquo;3D Model&rdquo; above to generate one.
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
