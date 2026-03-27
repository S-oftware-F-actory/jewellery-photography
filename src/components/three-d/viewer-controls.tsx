"use client";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColorPicker } from "@/components/three-d/color-picker";
import { RotateCcw, Loader2 } from "lucide-react";
import type { EmbedConfig } from "@/types/database";

interface ViewerControlsProps {
  config: EmbedConfig;
  onUpdate: (updates: Partial<EmbedConfig>) => void;
  saving: boolean;
}

export function ViewerControls({ config, onUpdate, saving }: ViewerControlsProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Viewer Settings</h3>
        {saving && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving...
          </span>
        )}
      </div>

      {/* Background Color */}
      <div className="space-y-2">
        <Label className="text-xs">Background Color</Label>
        <ColorPicker
          value={config.bg_color}
          onChange={(hex) => onUpdate({ bg_color: hex })}
        />
      </div>

      {/* Auto Rotate */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Auto Rotate</Label>
          <Button
            variant={config.autorotate ? "default" : "outline"}
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => onUpdate({ autorotate: !config.autorotate })}
          >
            <RotateCcw className="h-3 w-3" />
            {config.autorotate ? "On" : "Off"}
          </Button>
        </div>
        {config.autorotate && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Speed</span>
              <span>{config.autorotate_speed}°/s</span>
            </div>
            <input
              type="range"
              min={10}
              max={60}
              step={5}
              value={config.autorotate_speed}
              onChange={(e) =>
                onUpdate({ autorotate_speed: Number(e.target.value) })
              }
              className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-primary bg-muted"
            />
          </div>
        )}
      </div>

      {/* Lighting Preset */}
      <div className="space-y-2">
        <Label className="text-xs">Lighting</Label>
        <Select
          value={config.lighting_preset}
          onValueChange={(v) =>
            onUpdate({
              lighting_preset: v as EmbedConfig["lighting_preset"],
            })
          }
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="neutral">Neutral</SelectItem>
            <SelectItem value="studio">Studio</SelectItem>
            <SelectItem value="warm">Warm</SelectItem>
            <SelectItem value="cool">Cool</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
