"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EmbedConfig } from "@/types/database";

type EmbedConfigUpdate = Partial<
  Pick<EmbedConfig, "bg_color" | "autorotate" | "autorotate_speed" | "lighting_preset">
>;

export function useEmbedConfig(projectId: string) {
  const [config, setConfig] = useState<EmbedConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("embed_configs")
        .select("*")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) setConfig(data);
      setLoading(false);
    }

    load();
  }, [projectId]);

  const ensureConfig = useCallback(async (): Promise<EmbedConfig> => {
    if (config) return config;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Check again in case of race
    const { data: existing } = await supabase
      .from("embed_configs")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      setConfig(existing);
      return existing;
    }

    const { data: created, error } = await supabase
      .from("embed_configs")
      .insert({
        project_id: projectId,
        user_id: user.id,
        bg_color: "#ffffff",
        autorotate: true,
        autorotate_speed: 30,
        lighting_preset: "neutral",
      })
      .select()
      .single();

    if (error) throw error;
    setConfig(created);
    return created;
  }, [config, projectId]);

  const updateConfig = useCallback(
    (updates: EmbedConfigUpdate) => {
      if (!config) return;

      // Optimistic update
      setConfig((prev) => (prev ? { ...prev, ...updates } : prev));

      // Debounce the actual write
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setSaving(true);
        const supabase = createClient();
        await supabase
          .from("embed_configs")
          .update(updates)
          .eq("id", config.id);
        setSaving(false);
      }, 400);
    },
    [config]
  );

  return { config, loading, saving, updateConfig, ensureConfig };
}
