"use client";

import { useEffect, useRef, useState } from "react";
import { Smartphone, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ModelViewer } from "@/components/three-d/model-viewer";
import { createClient } from "@/lib/supabase/client";
import type { JewelleryType, ModelPlacement } from "@/types/database";

const PLACEMENT_TEXT: Record<string, string> = {
  ring: "Place near your hand to see how it looks at actual size",
  bracelet: "Place near your wrist to see it at actual size",
  watch: "Place near your wrist to see it at actual size",
  necklace: "View this piece in your space to appreciate the craftsmanship",
  pendant: "View this piece in your space to appreciate the detail",
  earring: "See this earring at actual size in your environment",
  brooch: "View this piece in your space at actual size",
};

const TYPE_TO_PLACEMENT: Record<string, ModelPlacement> = {
  ring: "finger",
  bracelet: "wrist",
  watch: "wrist",
  necklace: "neck",
  pendant: "neck",
  earring: "ear",
  brooch: "neck",
};

interface ArViewerProps {
  src: string;
  alt?: string;
  jewelleryType: JewelleryType;
  projectId: string;
}

export function ArViewer({ src, alt, jewelleryType, projectId }: ArViewerProps) {
  const [arSupported, setArSupported] = useState<boolean | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    // Check AR support
    async function checkAr() {
      if ("xr" in navigator) {
        try {
          const xr = (navigator as { xr: { isSessionSupported: (mode: string) => Promise<boolean> } }).xr;
          const supported = await xr.isSessionSupported("immersive-ar");
          setArSupported(supported);
        } catch {
          setArSupported(false);
        }
      } else {
        // Scene Viewer (Android) works without WebXR API check
        const isAndroid = /android/i.test(navigator.userAgent);
        setArSupported(isAndroid);
      }
    }

    checkAr();
  }, []);

  useEffect(() => {
    // Track AR session
    const supabase = createClient();

    async function startSession() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("ar_sessions")
        .insert({
          user_id: user.id,
          project_id: projectId,
          jewellery_type: jewelleryType,
          placement: TYPE_TO_PLACEMENT[jewelleryType] || "neck",
          status: "started",
          device_info: { userAgent: navigator.userAgent },
        })
        .select("id")
        .single();

      if (data) {
        sessionIdRef.current = data.id;
        startTimeRef.current = Date.now();
      }
    }

    startSession();

    return () => {
      // Update session on unmount
      if (sessionIdRef.current) {
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        supabase
          .from("ar_sessions")
          .update({
            status: arSupported === false ? "unsupported" : "completed",
            duration_seconds: duration,
            ended_at: new Date().toISOString(),
          })
          .eq("id", sessionIdRef.current)
          .then(() => {});
      }
    };
  }, [projectId, jewelleryType, arSupported]);

  if (arSupported === false) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-2">AR Not Supported</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Your device or browser does not support AR. Try opening this page on
            a mobile device with ARCore (Android) or ARKit (iOS) support.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* AR Viewer */}
      <Card className="overflow-hidden">
        <div className="aspect-square lg:aspect-[4/3]">
          <ModelViewer
            src={src}
            alt={alt}
            ar
            bgColor="#f8f9fa"
            autorotate
            autorotateSpeed={20}
            lightingPreset="studio"
          />
        </div>
      </Card>

      {/* Instructions */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
        <Smartphone className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-medium">View in Your Space</p>
          <p className="text-sm text-muted-foreground">
            {PLACEMENT_TEXT[jewelleryType] ||
              "View this piece in your space at actual size"}
            . Tap the AR icon on the 3D model above to launch the camera view.
          </p>
        </div>
      </div>

      {arSupported === null && (
        <p className="text-xs text-center text-muted-foreground">
          Checking AR compatibility...
        </p>
      )}
    </div>
  );
}
