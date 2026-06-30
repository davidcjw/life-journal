import "server-only";
import { getServiceClient } from "./supabase";
import { config } from "./config";

export type Entry = {
  id: string;
  event_date: string; // YYYY-MM-DD
  title: string;
  description: string | null;
  photos: string[]; // storage object paths in the private bucket
  created_at: string;
};

export type EntryWithUrls = Entry & { photoUrls: string[] };

const SIGNED_URL_TTL = 60 * 60; // 1 hour

/** All entries, oldest first (chronological book order). */
export async function getEntries(): Promise<Entry[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .select("id,event_date,title,description,photos,created_at")
    .order("event_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Entry[];
}

/** Sign a batch of storage paths into temporary URLs (order-independent via map). */
export async function signPhotoUrls(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(paths)];
  if (unique.length === 0) return out;
  const supabase = getServiceClient();
  const { data, error } = await supabase.storage
    .from(config.photosBucket)
    .createSignedUrls(unique, SIGNED_URL_TTL);
  if (error) throw error;
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) out.set(item.path, item.signedUrl);
  }
  return out;
}

/** Entries with their photos resolved to signed URLs. */
export async function getEntriesWithUrls(): Promise<EntryWithUrls[]> {
  const entries = await getEntries();
  const signed = await signPhotoUrls(entries.flatMap((e) => e.photos));
  return entries.map((e) => ({
    ...e,
    photoUrls: e.photos.map((p) => signed.get(p)).filter((u): u is string => Boolean(u)),
  }));
}

/** Download a single photo's bytes (for self-contained HTML export). */
export async function downloadPhotoDataUri(path: string): Promise<string | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.storage.from(config.photosBucket).download(path);
  if (error || !data) return null;
  const buf = Buffer.from(await data.arrayBuffer());
  const contentType = data.type || "image/jpeg";
  return `data:${contentType};base64,${buf.toString("base64")}`;
}
