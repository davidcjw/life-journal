"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { formatLongDate } from "@/lib/dates";
import { Close, Plus, Trash } from "./icons";

export type EditPhoto = { path: string; url: string };
export type EditEntryData = {
  id: string;
  event_date: string;
  title: string;
  description: string | null;
  photos: EditPhoto[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  entries: EditEntryData[];
  maxPhotos: number;
};

export function EditMemories({ open, onClose, entries, maxPhotos }: Props) {
  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="no-print fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Edit recent memories"
            className="my-auto w-full max-w-xl rounded-2xl bg-paper text-ink shadow-2xl"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="flex items-center justify-between border-b border-paper-edge px-5 py-4">
              <div>
                <h2 className="font-display text-lg font-semibold">Edit recent memories</h2>
                <p className="font-body text-xs text-ink-faint">
                  Change a description, or add and remove photos.
                </p>
              </div>
              <button
                className="lj-btn lj-icon-btn !h-9 !w-9"
                onClick={onClose}
                aria-label="Close editor"
              >
                <Close width={16} height={16} />
              </button>
            </header>

            <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
              {entries.length === 0 ? (
                <p className="py-8 text-center font-body text-sm text-ink-faint">
                  No memories yet. Add one through your Telegram bot.
                </p>
              ) : (
                entries.map((entry) => (
                  <EntryEditor key={entry.id} entry={entry} maxPhotos={maxPhotos} />
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function EntryEditor({ entry, maxPhotos }: { entry: EditEntryData; maxPhotos: number }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  // Local, optimistic state. Seeded once on mount; the modal remounts with
  // fresh server data each time it is reopened.
  const [savedDesc, setSavedDesc] = useState(entry.description ?? "");
  const [draft, setDraft] = useState(entry.description ?? "");
  const [photos, setPhotos] = useState<EditPhoto[]>(entry.photos);
  const [savingDesc, setSavingDesc] = useState(false);
  const [busyPhoto, setBusyPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = draft.trim() !== savedDesc.trim();
  const full = photos.length >= maxPhotos;

  async function saveDescription() {
    setError(null);
    setSavingDesc(true);
    const next = draft.trim() ? draft.trim() : null;
    try {
      const res = await fetch(`/api/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: next }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Save failed.");
      setSavedDesc(next ?? "");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSavingDesc(false);
    }
  }

  async function addPhoto(file: File) {
    setError(null);
    setBusyPhoto(true);
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch(`/api/entries/${entry.id}/photos`, { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Upload failed.");
      setPhotos((prev) => [...prev, json.item as EditPhoto]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusyPhoto(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removePhoto(path: string) {
    setError(null);
    setBusyPhoto(true);
    try {
      const res = await fetch(`/api/entries/${entry.id}/photos`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Delete failed.");
      setPhotos((prev) => prev.filter((p) => p.path !== path));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBusyPhoto(false);
    }
  }

  return (
    <section className="rounded-xl border border-paper-edge bg-paper-2/60 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-base font-semibold leading-tight">{entry.title}</h3>
        <span className="shrink-0 font-body text-[0.65rem] uppercase tracking-wider text-ink-faint">
          {formatLongDate(entry.event_date)}
        </span>
      </div>

      <label className="mt-3 block font-body text-xs font-medium text-ink-soft">Description</label>
      <textarea
        className="mt-1 w-full resize-y rounded-lg border border-paper-edge bg-paper px-3 py-2 font-body text-sm text-ink outline-none focus:border-accent"
        rows={3}
        value={draft}
        placeholder="Add a short description…"
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="mt-2 flex justify-end">
        <button
          className="lj-btn !py-1.5 !text-xs"
          onClick={saveDescription}
          disabled={!dirty || savingDesc}
        >
          {savingDesc ? "Saving…" : "Save description"}
        </button>
      </div>

      <label className="mt-3 block font-body text-xs font-medium text-ink-soft">
        Photos ({photos.length}/{maxPhotos})
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        {photos.map((photo) => (
          <div key={photo.path} className="group relative h-20 w-20 overflow-hidden rounded-lg">
            <img src={photo.url} alt="" className="h-full w-full object-cover" />
            <button
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-40"
              onClick={() => removePhoto(photo.path)}
              disabled={busyPhoto}
              aria-label="Delete photo"
            >
              <Trash width={13} height={13} />
            </button>
          </div>
        ))}

        {!full ? (
          <button
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-ink-faint/60 text-ink-faint transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
            onClick={() => fileRef.current?.click()}
            disabled={busyPhoto}
            aria-label="Add photo"
          >
            <Plus width={18} height={18} />
            <span className="font-body text-[0.6rem]">{busyPhoto ? "Working…" : "Add"}</span>
          </button>
        ) : null}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) addPhoto(file);
        }}
      />

      {error ? <p className="mt-2 font-body text-xs text-brown">{error}</p> : null}
    </section>
  );
}
