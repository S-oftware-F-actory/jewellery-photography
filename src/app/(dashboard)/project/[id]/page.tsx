"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Camera,
  Sparkles,
  Box,
  Download,
  Loader2,
  RotateCcw,
  Code,
  CheckCircle2,
  XCircle,
  SplitSquareHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { getSignedUrls, downloadImage } from "@/lib/storage";
import { BeforeAfterSlider } from "@/components/before-after-slider";
import { EmbedCodeDialog } from "@/components/three-d/embed-code-dialog";
import { useEmbedConfig } from "@/hooks/use-embed-config";
import type {
  Project,
  SourceImage,
  GeneratedImage,
  GenerationJob,
} from "@/types/database";

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [sourceImages, setSourceImages] = useState<SourceImage[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [activeJobs, setActiveJobs] = useState<GenerationJob[]>([]);
  const [completedJobs, setCompletedJobs] = useState<string[]>([]);
  const [failedJobs, setFailedJobs] = useState<GenerationJob[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [sourceUrls, setSourceUrls] = useState<Record<string, string>>({});
  const [generatedUrls, setGeneratedUrls] = useState<Record<string, string>>({});
  const [compareImage, setCompareImage] = useState<GeneratedImage | null>(null);
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false);

  const { config: embedConfig, ensureConfig } = useEmbedConfig(projectId);

  // Resolve signed URLs for generated images
  const resolveGeneratedUrls = useCallback(async (images: GeneratedImage[]) => {
    const completed = images.filter((i) => i.status === "completed" && i.storage_path);
    if (completed.length === 0) return;
    const paths = completed.map((i) => i.storage_path);
    const urls = await getSignedUrls("generated", paths);
    setGeneratedUrls((prev) => ({ ...prev, ...urls }));
  }, []);

  useEffect(() => {
    const supabase = createClient();

    async function loadProject() {
      const [projectRes, sourcesRes, generatedRes, jobsRes] =
        await Promise.all([
          supabase.from("projects").select("*").eq("id", projectId).single(),
          supabase
            .from("source_images")
            .select("*")
            .eq("project_id", projectId)
            .order("order"),
          supabase
            .from("generated_images")
            .select("*")
            .eq("project_id", projectId)
            .order("created_at", { ascending: false }),
          supabase
            .from("generation_queue")
            .select("*")
            .eq("project_id", projectId)
            .in("status", ["pending", "processing"])
            .order("created_at", { ascending: false }),
        ]);

      if (projectRes.data) setProject(projectRes.data);
      if (sourcesRes.data) {
        setSourceImages(sourcesRes.data);
        // Resolve source image URLs
        const paths = sourcesRes.data.map((i) => i.storage_path);
        const urls = await getSignedUrls("raw-uploads", paths);
        setSourceUrls(urls);
      }
      if (generatedRes.data) {
        setGeneratedImages(generatedRes.data);
        await resolveGeneratedUrls(generatedRes.data);
      }
      if (jobsRes.data) setActiveJobs(jobsRes.data);
      setLoading(false);
    }

    loadProject();

    // Subscribe to generation_queue changes for real-time progress
    const queueChannel = supabase
      .channel(`queue-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "generation_queue",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const updated = payload.new as GenerationJob;
          if (updated.status === "completed") {
            // Show completion state briefly before removing
            setCompletedJobs((prev) => [...prev, updated.id]);
            toast.success(`${updated.type.replace("_", " ")} generated successfully!`);
            setTimeout(() => {
              setActiveJobs((prev) => prev.filter((j) => j.id !== updated.id));
              setCompletedJobs((prev) => prev.filter((id) => id !== updated.id));
            }, 2000);
            // Refresh generated images
            supabase
              .from("generated_images")
              .select("*")
              .eq("project_id", projectId)
              .order("created_at", { ascending: false })
              .then(({ data }) => {
                if (data) {
                  setGeneratedImages(data);
                  resolveGeneratedUrls(data);
                }
              });
            setGenerating(null);
          } else if (updated.status === "failed") {
            setActiveJobs((prev) => prev.filter((j) => j.id !== updated.id));
            setFailedJobs((prev) => [updated, ...prev]);
            toast.error(`${updated.type.replace("_", " ")} generation failed`);
            setGenerating(null);
          } else {
            // Update progress
            setActiveJobs((prev) =>
              prev.map((j) => (j.id === updated.id ? updated : j))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(queueChannel);
    };
  }, [projectId, resolveGeneratedUrls]);

  const triggerGeneration = async (
    type: "product_shot" | "model_shot" | "3d_model"
  ) => {
    if (generating) return;
    setGenerating(type);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, type }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Generation failed");
        setGenerating(null);
        return;
      }

      setActiveJobs((prev) => [
        {
          id: data.queueId,
          project_id: projectId,
          type,
          status: "processing",
          current_step: 1,
          current_step_label: "Starting...",
          total_steps: type === "3d_model" ? 2 : 4,
          replicate_prediction_id: data.predictionId,
          started_at: new Date().toISOString(),
          completed_at: null,
          error: null,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch {
      toast.error("Something went wrong");
      setGenerating(null);
    }
  };

  const productShots = generatedImages.filter(
    (img) => img.type === "product_shot" && img.status === "completed"
  );
  const modelShots = generatedImages.filter(
    (img) => img.type === "model_shot" && img.status === "completed"
  );
  const models3d = generatedImages.filter(
    (img) => img.type === "3d_model" && img.status === "completed"
  );

  const firstSourceUrl = sourceImages.length > 0 ? sourceUrls[sourceImages[0].storage_path] : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-pulse text-muted-foreground">
          Loading project...
        </div>
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
            <h1 className="text-2xl font-bold tracking-tight">
              {project.name}
            </h1>
            <Badge variant="outline" className="capitalize">
              {project.jewellery_type}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            {sourceImages.length} source images &middot;{" "}
            {generatedImages.filter((i) => i.status === "completed").length}{" "}
            generated
          </p>
        </div>
        {generatedImages.filter((i) => i.status === "completed").length > 0 && (
          <Link href={`/gallery/${projectId}`}>
            <Button variant="outline" className="gap-2">
              View Gallery
            </Button>
          </Link>
        )}
      </div>

      {/* Active Generation Progress */}
      {activeJobs.length > 0 && (
        <div className="space-y-3">
          {activeJobs.map((job) => {
            const isCompleted = completedJobs.includes(job.id);
            return (
              <Card
                key={job.id}
                className={isCompleted
                  ? "border-green-500/20 bg-green-500/5"
                  : "border-primary/20 bg-primary/5"
                }
              >
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium capitalize">
                          {job.type.replace("_", " ")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {isCompleted ? "Complete!" : `Step ${job.current_step}/${job.total_steps}`}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {isCompleted ? "Image ready" : job.current_step_label}
                      </p>
                      <Progress
                        value={isCompleted ? 100 : (job.current_step / job.total_steps) * 100}
                        className="h-1.5"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Failed Jobs */}
      {failedJobs.length > 0 && (
        <div className="space-y-3">
          {failedJobs.map((job) => (
            <Card key={job.id} className="border-destructive/20 bg-destructive/5">
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <XCircle className="h-5 w-5 text-destructive" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium capitalize">
                        {job.type.replace("_", " ")} — Failed
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => {
                          setFailedJobs((prev) => prev.filter((j) => j.id !== job.id));
                          triggerGeneration(job.type as "product_shot" | "model_shot" | "3d_model");
                        }}
                      >
                        <RotateCcw className="h-3 w-3" /> Retry
                      </Button>
                    </div>
                    {job.error && (
                      <p className="text-sm text-muted-foreground mt-1">{job.error}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Source Images */}
      <Card>
        <CardHeader>
          <CardTitle>Source Images</CardTitle>
          <CardDescription>
            Original photos uploaded for this piece
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
            {sourceImages.map((img) => (
              <div
                key={img.id}
                className="aspect-square rounded-lg overflow-hidden border border-border bg-muted"
              >
                {sourceUrls[img.storage_path] ? (
                  <img
                    src={sourceUrls[img.storage_path]}
                    alt={img.file_name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                    {img.file_name}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Generation Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          className={`cursor-pointer hover:shadow-md transition-shadow ${generating === "product_shot" ? "opacity-50 pointer-events-none" : ""}`}
          onClick={() => triggerGeneration("product_shot")}
        >
          <CardContent className="flex items-center gap-4 py-6">
            <div className="rounded-full bg-primary/10 p-3">
              <Camera className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">Product Shots</div>
              <div className="text-sm text-muted-foreground">
                White background, studio quality
              </div>
            </div>
            <Badge>{productShots.length}</Badge>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer hover:shadow-md transition-shadow ${generating === "model_shot" ? "opacity-50 pointer-events-none" : ""}`}
          onClick={() => triggerGeneration("model_shot")}
        >
          <CardContent className="flex items-center gap-4 py-6">
            <div className="rounded-full bg-primary/10 p-3">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">Model Shots</div>
              <div className="text-sm text-muted-foreground">
                Jewellery on AI models
              </div>
            </div>
            <Badge>{modelShots.length}</Badge>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer hover:shadow-md transition-shadow ${generating === "3d_model" ? "opacity-50 pointer-events-none" : ""}`}
          onClick={() => triggerGeneration("3d_model")}
        >
          <CardContent className="flex items-center gap-4 py-6">
            <div className="rounded-full bg-primary/10 p-3">
              <Box className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">3D Model</div>
              <div className="text-sm text-muted-foreground">
                Interactive, embeddable viewer
              </div>
            </div>
            <Badge>{models3d.length}</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Generated Results */}
      {generatedImages.filter((i) => i.status === "completed").length > 0 && (
        <Tabs defaultValue="product" className="space-y-4">
          <TabsList>
            <TabsTrigger value="product">
              Product Shots ({productShots.length})
            </TabsTrigger>
            <TabsTrigger value="model">
              Model Shots ({modelShots.length})
            </TabsTrigger>
            <TabsTrigger value="3d">3D ({models3d.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="product">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {productShots.map((img) => (
                <Card key={img.id} className="overflow-hidden">
                  <div className="aspect-square bg-white flex items-center justify-center border-b">
                    {generatedUrls[img.storage_path] ? (
                      <img
                        src={generatedUrls[img.storage_path]}
                        alt="Product shot"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="text-sm text-muted-foreground">Loading...</div>
                    )}
                  </div>
                  <CardContent className="p-3 flex items-center justify-between">
                    <Badge variant="default">Completed</Badge>
                    <div className="flex gap-1">
                      {firstSourceUrl && generatedUrls[img.storage_path] && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Compare"
                          onClick={() => setCompareImage(img)}
                        >
                          <SplitSquareHorizontal className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => downloadImage("generated", img.storage_path, `product-shot-${img.id.slice(0, 8)}.png`)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => triggerGeneration("product_shot")}
                      >
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
                    {generatedUrls[img.storage_path] ? (
                      <img
                        src={generatedUrls[img.storage_path]}
                        alt={`${img.model_placement} shot`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="text-sm text-muted-foreground">Loading...</div>
                    )}
                  </div>
                  <CardContent className="p-3 flex items-center justify-between">
                    <Badge variant="default" className="capitalize">
                      {img.model_placement}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => downloadImage("generated", img.storage_path, `model-shot-${img.id.slice(0, 8)}.png`)}
                    >
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
                    <Link href={`/project/${projectId}/3d`}>
                      <Button variant="outline" className="gap-2">
                        <Box className="h-4 w-4" /> View 3D
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={async () => {
                        await ensureConfig();
                        setEmbedDialogOpen(true);
                      }}
                    >
                      <Code className="h-4 w-4" /> Get Embed Code
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => {
                        const model = models3d[0];
                        if (model) downloadImage("3d-models", model.storage_path, `3d-model-${model.id.slice(0, 8)}.glb`);
                      }}
                    >
                      <Download className="h-4 w-4" /> Download GLB
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-muted-foreground">
                  No 3D models generated yet. Click &ldquo;3D Model&rdquo; above
                  to generate one.
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Before/After Comparison Dialog */}
      <Dialog open={!!compareImage} onOpenChange={() => setCompareImage(null)}>
        <DialogContent className="max-w-3xl p-6">
          {compareImage && firstSourceUrl && generatedUrls[compareImage.storage_path] && (
            <div className="space-y-4">
              <h3 className="font-semibold">Before / After Comparison</h3>
              <BeforeAfterSlider
                beforeSrc={firstSourceUrl}
                afterSrc={generatedUrls[compareImage.storage_path]}
                className="rounded-lg overflow-hidden"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Embed Code Dialog */}
      <EmbedCodeDialog
        open={embedDialogOpen}
        onOpenChange={setEmbedDialogOpen}
        publicToken={embedConfig?.public_token ?? null}
      />
    </div>
  );
}
