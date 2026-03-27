"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Generation {
  id: string;
  project_id: string;
  type: string;
  status: string;
  current_step: number;
  current_step_label: string;
  total_steps: number;
  replicate_prediction_id: string | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  projects?: {
    name: string;
    user_id: string;
    users?: { email: string; name: string | null };
  };
}

const statusVariant = (status: string) => {
  switch (status) {
    case "completed":
      return "default" as const;
    case "failed":
      return "destructive" as const;
    case "processing":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
};

export default function AdminGenerationsPage() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchGenerations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("type", typeFilter);

      const res = await fetch(`/api/admin/generations?${params}`);
      const data = await res.json();

      setGenerations(data.generations || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch {
      toast.error("Failed to fetch generations");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter]);

  useEffect(() => {
    fetchGenerations();
  }, [fetchGenerations]);

  const handleFilterChange = (setter: (v: string) => void, value: string | null) => {
    setter(!value || value === "all" ? "" : value);
    setPage(1);
  };

  const formatDuration = (started: string | null, completed: string | null) => {
    if (!started) return "—";
    const start = new Date(started).getTime();
    const end = completed ? new Date(completed).getTime() : Date.now();
    const seconds = Math.round((end - start) / 1000);
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Generation Monitoring</h1>
          <p className="text-sm text-muted-foreground">{total} total generations</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchGenerations}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select
          value={statusFilter || "all"}
          onValueChange={(v) => handleFilterChange(setStatusFilter, v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={typeFilter || "all"}
          onValueChange={(v) => handleFilterChange(setTypeFilter, v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="product_shot">Product Shot</SelectItem>
            <SelectItem value="model_shot">Model Shot</SelectItem>
            <SelectItem value="3d_model">3D Model</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Generations Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : generations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No generations found
                  </TableCell>
                </TableRow>
              ) : (
                generations.map((gen) => (
                  <TableRow key={gen.id}>
                    <TableCell>
                      <Badge variant={statusVariant(gen.status)}>
                        {gen.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">
                      {gen.type.replace("_", " ")}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="font-mono">
                          {gen.current_step}/{gen.total_steps}
                        </span>
                        {gen.current_step_label && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {gen.current_step_label}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {gen.projects?.name || (
                        <span className="text-muted-foreground font-mono text-xs">
                          {gen.project_id.slice(0, 8)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {gen.projects?.users?.email || "—"}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {formatDuration(gen.started_at, gen.completed_at)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(gen.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Error Details for Failed */}
      {generations.some((g) => g.status === "failed" && g.error) && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-medium mb-3 text-destructive">Failed Generation Errors</h3>
            <div className="space-y-2">
              {generations
                .filter((g) => g.status === "failed" && g.error)
                .map((gen) => (
                  <div key={gen.id} className="text-sm bg-destructive/10 rounded p-3">
                    <p className="font-mono text-xs text-muted-foreground mb-1">
                      {gen.id.slice(0, 8)} — {gen.type}
                    </p>
                    <p className="text-destructive">{gen.error}</p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
