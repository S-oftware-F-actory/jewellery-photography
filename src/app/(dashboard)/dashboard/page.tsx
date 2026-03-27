"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderPlus, Images, CreditCard, Sparkles, ArrowRight, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { getSignedUrls } from "@/lib/storage";
import type { Project, SourceImage } from "@/types/database";

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [credits, setCredits] = useState(0);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient();

        // Load projects
        const { data: projectData, error: projectError } = await supabase
          .from("projects")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10);

        if (projectError) throw projectError;
        if (projectData) setProjects(projectData);

        // Load user credits
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userData } = await supabase
            .from("users")
            .select("credits_remaining")
            .eq("id", user.id)
            .single();
          if (userData) setCredits(userData.credits_remaining);
        }

        // Load first source image for each project as thumbnail
        if (projectData && projectData.length > 0) {
          const projectIds = projectData.map((p) => p.id);
          const { data: sourceImages } = await supabase
            .from("source_images")
            .select("project_id, storage_path")
            .in("project_id", projectIds)
            .eq("order", 0);

          if (sourceImages && sourceImages.length > 0) {
            const paths = sourceImages.map((img) => img.storage_path);
            const urls = await getSignedUrls("raw-uploads", paths);

            const thumbMap: Record<string, string> = {};
            for (const img of sourceImages) {
              if (urls[img.storage_path]) {
                thumbMap[img.project_id] = urls[img.storage_path];
              }
            }
            setThumbnails(thumbMap);
          }
        }
      } catch (err) {
        setError("Failed to load dashboard data. Please try refreshing the page.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const statusColor = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "processing": return "secondary";
      default: return "outline";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertCircle className="h-12 w-12 text-destructive/50" />
        <p className="text-muted-foreground text-center max-w-sm">{error}</p>
        <Button variant="outline" className="gap-2" onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Manage your jewellery photography projects</p>
        </div>
        <Link href="/project/new">
          <Button className="gap-2">
            <FolderPlus className="h-4 w-4" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Credits Remaining</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{credits}</div>
            <Link href="/credits" className="text-xs text-muted-foreground hover:text-primary">
              Manage credits <ArrowRight className="inline h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <Images className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projects.length}</div>
            <p className="text-xs text-muted-foreground">Across all collections</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Images Generated</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {projects.reduce((sum, p) => sum + (p.generated_image_count || 0), 0)}
            </div>
            <p className="text-xs text-muted-foreground">Product + model + 3D</p>
          </CardContent>
        </Card>
      </div>

      {/* Projects */}
      {projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Images className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <CardTitle className="mb-2">No projects yet</CardTitle>
            <CardDescription className="mb-6 text-center max-w-sm">
              Create your first project to start generating professional jewellery photos with AI
            </CardDescription>
            <Link href="/project/new">
              <Button className="gap-2">
                <FolderPlus className="h-4 w-4" />
                Create Your First Project
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div>
          <h2 className="text-lg font-semibold mb-4">Recent Projects</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link key={project.id} href={`/project/${project.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full overflow-hidden">
                  <div className="aspect-[16/9] bg-muted relative">
                    {thumbnails[project.id] ? (
                      <img
                        src={thumbnails[project.id]}
                        alt={project.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Images className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{project.name}</CardTitle>
                      <Badge variant={statusColor(project.status)}>{project.status}</Badge>
                    </div>
                    <CardDescription className="capitalize">
                      {project.jewellery_type}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{project.source_image_count} source</span>
                      <span>{project.generated_image_count} generated</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
