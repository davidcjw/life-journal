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

export type PhotoItem = { path: string; url: string };
export type EntryWithUrls = Entry & { photoUrls: string[]; photoItems: PhotoItem[] };

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

/** The most recently-dated entries first (for the Telegram edit picker). */
export async function getRecentEntries(limit = 10): Promise<Entry[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .select("id,event_date,title,description,photos,created_at")
    .order("event_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
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
  return entries.map((e) => {
    const photoItems: PhotoItem[] = e.photos
      .map((path) => ({ path, url: signed.get(path) }))
      .filter((i): i is PhotoItem => Boolean(i.url));
    return { ...e, photoItems, photoUrls: photoItems.map((i) => i.url) };
  });
}

// ── Editing existing entries ─────────────────────────────────────────────────

const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "heic", "heif"] as const;

/** Map an image extension to the MIME type the storage bucket accepts. */
export function imageExtToMime(ext: string): string {
  switch (ext.toLowerCase()) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    default:
      return "image/jpeg";
  }
}

/** Normalize a filename/mime hint to a supported image extension (defaults to jpg). */
export function normalizeImageExt(hint: string): string {
  const ext = (hint.split(".").pop() || hint).toLowerCase();
  return (IMAGE_EXTS as readonly string[]).includes(ext) ? ext : "jpg";
}

async function getEntry(id: string): Promise<Entry | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .select("id,event_date,title,description,photos,created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Entry | null) ?? null;
}

/** Public lookup of a single entry by id (null if it no longer exists). */
export async function getEntryById(id: string): Promise<Entry | null> {
  return getEntry(id);
}

/** Update an entry's title (trimmed, capped to match the /new flow). */
export async function updateEntryTitle(id: string, title: string): Promise<void> {
  const value = title.trim().slice(0, 200);
  const supabase = getServiceClient();
  const { error } = await supabase.from("journal_entries").update({ title: value }).eq("id", id);
  if (error) throw error;
}

/** Update an entry's event date (caller passes an already-parsed YYYY-MM-DD). */
export async function updateEntryDate(id: string, eventDate: string): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from("journal_entries")
    .update({ event_date: eventDate })
    .eq("id", id);
  if (error) throw error;
}

/** Update an entry's free-text description (null clears it). */
export async function updateEntryDescription(
  id: string,
  description: string | null,
): Promise<void> {
  const value = description && description.trim().length ? description.trim().slice(0, 4000) : null;
  const supabase = getServiceClient();
  const { error } = await supabase
    .from("journal_entries")
    .update({ description: value })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Upload a new photo for an entry and append its path. Enforces the per-entry
 * photo cap. Returns the stored path plus a signed URL for immediate display.
 */
export async function addEntryPhoto(
  id: string,
  bytes: Uint8Array,
  ext: string,
): Promise<{ ok: true; item: PhotoItem } | { ok: false; reason: "not_found" | "full" }> {
  const entry = await getEntry(id);
  if (!entry) return { ok: false, reason: "not_found" };
  if (entry.photos.length >= config.maxPhotos) return { ok: false, reason: "full" };

  const supabase = getServiceClient();
  const safeExt = normalizeImageExt(ext);
  const objectPath = `entries/${crypto.randomUUID()}.${safeExt}`;
  const up = await supabase.storage
    .from(config.photosBucket)
    .upload(objectPath, bytes, { contentType: imageExtToMime(safeExt), upsert: false });
  if (up.error) throw up.error;

  const photos = [...entry.photos, objectPath];
  const { error } = await supabase.from("journal_entries").update({ photos }).eq("id", id);
  if (error) {
    // Roll back the orphaned upload so storage doesn't drift from the row.
    await supabase.storage.from(config.photosBucket).remove([objectPath]).catch(() => {});
    throw error;
  }

  const signed = await signPhotoUrls([objectPath]);
  return { ok: true, item: { path: objectPath, url: signed.get(objectPath) ?? "" } };
}

/** Remove one photo (by storage path) from an entry, then delete the object. */
export async function deleteEntryPhoto(
  id: string,
  path: string,
): Promise<{ ok: true } | { ok: false; reason: "not_found" }> {
  const entry = await getEntry(id);
  if (!entry) return { ok: false, reason: "not_found" };
  if (!entry.photos.includes(path)) return { ok: false, reason: "not_found" };

  const supabase = getServiceClient();
  const photos = entry.photos.filter((p) => p !== path);
  const { error } = await supabase.from("journal_entries").update({ photos }).eq("id", id);
  if (error) throw error;
  // Best-effort object cleanup; the row is already consistent.
  await supabase.storage.from(config.photosBucket).remove([path]).catch(() => {});
  return { ok: true };
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
