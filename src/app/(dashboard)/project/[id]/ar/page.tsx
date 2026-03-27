"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ArViewer } from "@/components/three-d/ar-viewer";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import type { Project, GeneratedImage } from "@/types/database";

export default function ArPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [model3d, setModel3d] = useState<GeneratedImage | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
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
      <div>
        <Link
          href={`/project/${projectId}/3d`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to 3D Viewer
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">
            {project.name} — AR View
          </h1>
          <Badge variant="secondary" className="text-xs">
            Beta
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Place this jewellery piece in your real environment using augmented
          reality
        </p>
      </div>

      {/* AR Viewer */}
      <ArViewer
        src={glbUrl}
        alt={`${project.name} AR View`}
        jewelleryType={project.jewellery_type}
        projectId={projectId}
      />
    </div>
  );
}
