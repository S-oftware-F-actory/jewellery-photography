"use client";

import Script from "next/script";

interface ModelViewerProps {
  src: string;
  alt?: string;
  bgColor?: string;
  autorotate?: boolean;
  autorotateSpeed?: number;
  lightingPreset?: "neutral" | "studio" | "warm" | "cool";
  ar?: boolean;
  className?: string;
}

const LIGHTING_MAP: Record<
  string,
  { exposure: string; shadowIntensity: string; filter?: string }
> = {
  neutral: { exposure: "1", shadowIntensity: "1" },
  studio: { exposure: "1.2", shadowIntensity: "1.5" },
  warm: { exposure: "1.1", shadowIntensity: "0.8", filter: "sepia(0.15)" },
  cool: { exposure: "0.9", shadowIntensity: "1.2", filter: "saturate(0.9) hue-rotate(10deg)" },
};

export function ModelViewer({
  src,
  alt = "3D Jewellery Model",
  bgColor = "#ffffff",
  autorotate = true,
  autorotateSpeed = 30,
  lightingPreset = "neutral",
  ar = false,
  className = "",
}: ModelViewerProps) {
  const lighting = LIGHTING_MAP[lightingPreset] || LIGHTING_MAP.neutral;

  return (
    <>
      <Script
        src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"
        type="module"
        strategy="afterInteractive"
      />
      <div
        className={`w-full h-full ${className}`}
        style={{
          backgroundColor: bgColor,
          filter: lighting.filter,
        }}
      >
        {/* @ts-expect-error model-viewer is a custom element */}
        <model-viewer
          src={src}
          alt={alt}
          auto-rotate={autorotate ? "" : undefined}
          auto-rotate-delay="0"
          rotation-per-second={`${autorotateSpeed}deg`}
          camera-controls
          touch-action="pan-y"
          environment-image="neutral"
          shadow-intensity={lighting.shadowIntensity}
          exposure={lighting.exposure}
          ar={ar ? "" : undefined}
          ar-modes={ar ? "webxr scene-viewer" : undefined}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </>
  );
}
