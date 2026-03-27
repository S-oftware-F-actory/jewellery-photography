"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Code, Smartphone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ModelViewer } from "@/components/three-d/model-viewer";
import { ViewerControls } from "@/components/three-d/viewer-controls";
import { EmbedCodeDialog } from "@/components/three-d/embed-code-dialog";
import { useEmbedConfig } from "@/hooks/use-embed-config";
import { createClient } from "@/lib/supabase/client";
import type { Project, GeneratedImage } from "@/types/database";

export default function ThreeDViewerPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [model3d, setModel3d] = useState<GeneratedImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false);

  const { config, loading: configLoading, saving, updateConfig, ensureConfig } =
    useEmbedConfig(projectId);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const [projectRes, modelRes] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).single(),
        supabase
          .from("generated_images")
          .select("*")
          .eq("project_id", projectId)
          .eq("type", "3d_model")
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (projectRes.data) setProject(projectRes.data);
      if (modelRes.data) setModel3d(modelRes.data);
      setLoading(false);
    }

    load();
  }, [projectId]);

  const handleOpenEmbed = async () => {
    await ensureConfig();
    setEmbedDialogOpen(true);
  };

  if (loading || configLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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

  if (!model3d) {
    return (
      <div className="space-y-4">
        <Link
          href={`/project/${projectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Project
        </Link>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No 3D model has been generated for this project yet. Go back and
            generate one first.
          </CardContent>
        </Card>
      </div>
    );
  }

  const glbUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/3d-models/${model3d.storage_path}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/project/${projectId}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Project
          </Link>
          <h1 className="text-xl font-bold tracking-tight">
            {project.name} — 3D Viewer
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleOpenEmbed}>
            <Code className="h-4 w-4" />
            Get Embed Code
          </Button>
          <Link href={`/project/${projectId}/ar`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Smartphone className="h-4 w-4" />
              Try AR
              <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">
                Beta
              </Badge>
            </Button>
          </Link>
        </div>
      </div>

      {/* Viewer + Controls */}
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* 3D Viewer */}
        <Card className="overflow-hidden">
          <div className="aspect-square lg:aspect-[4/3]">
            <ModelViewer
              src={glbUrl}
              alt={`${project.name} 3D Model`}
              bgColor={config?.bg_color}
              autorotate={config?.autorotate}
              autorotateSpeed={config?.autorotate_speed}
              lightingPreset={config?.lighting_preset}
            />
          </div>
        </Card>

        {/* Controls Panel */}
        <Card>
          <CardContent className="pt-6">
            {config ? (
              <ViewerControls
                config={config}
                onUpdate={updateConfig}
                saving={saving}
              />
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Loading settings...
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Embed Dialog */}
      <EmbedCodeDialog
        open={embedDialogOpen}
        onOpenChange={setEmbedDialogOpen}
        publicToken={config?.public_token ?? null}
      />
    </div>
  );
}
