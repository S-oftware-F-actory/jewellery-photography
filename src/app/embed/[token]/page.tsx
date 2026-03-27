import Script from "next/script";

interface EmbedPageProps {
  params: Promise<{ token: string }>;
}

export default async function EmbedPage({ params }: EmbedPageProps) {
  const { token } = await params;

  // Fetch embed config server-side
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  let config = null;

  try {
    const res = await fetch(`${appUrl}/api/embed/${token}`, {
      cache: "no-store",
    });
    if (res.ok) config = await res.json();
  } catch {
    // Will show error state below
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        3D model not available
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"
        type="module"
      />
      <div className="w-full h-screen" style={{ backgroundColor: config.config.bgColor }}>
        {/* @ts-expect-error model-viewer is a custom element */}
        <model-viewer
          src={config.modelUrl}
          alt={config.project?.name || "3D Jewellery Model"}
          auto-rotate={config.config.autorotate ? "" : undefined}
          auto-rotate-delay="0"
          rotation-per-second={`${config.config.autorotateSpeed || 30}deg`}
          camera-controls
          touch-action="pan-y"
          style={{ width: "100%", height: "100%" }}
          environment-image="neutral"
          shadow-intensity="1"
          exposure="1"
        />
      </div>
    </>
  );
}
