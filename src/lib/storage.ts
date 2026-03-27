import { createClient } from "@/lib/supabase/client";

const DEFAULT_EXPIRY = 3600; // 1 hour

/**
 * Get a signed URL for a single file in a private bucket.
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn = DEFAULT_EXPIRY
): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Get signed URLs for multiple files in a private bucket.
 * Returns a map of storage_path → signed URL.
 */
export async function getSignedUrls(
  bucket: string,
  paths: string[],
  expiresIn = DEFAULT_EXPIRY
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, expiresIn);
  if (error || !data) return {};

  const urlMap: Record<string, string> = {};
  for (const item of data) {
    if (item.signedUrl && item.path) {
      urlMap[item.path] = item.signedUrl;
    }
  }
  return urlMap;
}

/**
 * Get a public URL for a file in a public bucket (e.g. 3d-models).
 */
export function getPublicUrl(bucket: string, path: string): string {
  const supabase = createClient();
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Download an image by fetching the signed URL as a blob and triggering a save.
 */
export async function downloadImage(
  bucket: string,
  path: string,
  fileName: string
): Promise<void> {
  const url = await getSignedUrl(bucket, path);
  if (!url) return;

  const response = await fetch(url);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}
