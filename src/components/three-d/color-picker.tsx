"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DEFAULT_PRESETS = [
  "#ffffff", // white
  "#000000", // black
  "#f5f0e8", // cream
  "#1e293b", // navy
  "#6b7280", // gray
  "#fce4ec", // blush
];

interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  presets?: string[];
}

export function ColorPicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
}: ColorPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-9 w-9 p-0 border-2"
          style={{ backgroundColor: value }}
          onClick={() => inputRef.current?.click()}
        >
          <span className="sr-only">Pick color</span>
        </Button>
        <input
          ref={inputRef}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
        />
        <Input
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
          }}
          className="h-9 w-24 font-mono text-xs"
          maxLength={7}
        />
      </div>
      <div className="flex items-center gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
              value === preset ? "border-primary ring-2 ring-primary/30" : "border-border"
            }`}
            style={{ backgroundColor: preset }}
            onClick={() => onChange(preset)}
          >
            <span className="sr-only">{preset}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
