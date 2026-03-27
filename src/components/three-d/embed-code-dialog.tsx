"use client";

import { useState } from "react";
import { Copy, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface EmbedCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publicToken: string | null;
  loading?: boolean;
}

export function EmbedCodeDialog({
  open,
  onOpenChange,
  publicToken,
  loading = false,
}: EmbedCodeDialogProps) {
  const [width, setWidth] = useState(600);
  const [height, setHeight] = useState(400);
  const [copied, setCopied] = useState(false);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const snippet = `<iframe src="${appUrl}/embed/${publicToken || "..."}" width="${width}" height="${height}" frameborder="0" allow="xr-spatial-tracking" style="border-radius: 8px;"></iframe>`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    toast.success("Embed code copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Embed 3D Viewer</DialogTitle>
          <DialogDescription>
            Copy this HTML snippet to embed the interactive 3D viewer on your
            website.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Dimensions */}
            <div className="flex items-center gap-4">
              <div className="space-y-1 flex-1">
                <Label className="text-xs">Width (px)</Label>
                <Input
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  min={200}
                  max={1920}
                  className="h-8"
                />
              </div>
              <div className="space-y-1 flex-1">
                <Label className="text-xs">Height (px)</Label>
                <Input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  min={200}
                  max={1080}
                  className="h-8"
                />
              </div>
            </div>

            {/* Code snippet */}
            <div className="relative">
              <pre className="bg-muted rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                {snippet}
              </pre>
            </div>

            <Button onClick={handleCopy} className="w-full gap-2">
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy to Clipboard
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
