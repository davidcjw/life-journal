"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import type { FlipApi } from "./Flipbook";
import type { EntryPageData } from "./EntryPage";
import { EditMemories, type EditEntryData } from "./EditMemories";
import { ChevronLeft, ChevronRight, Download, Pencil, Printer, Send } from "./icons";

const Flipbook = dynamic(() => import("./Flipbook"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto aspect-[460/624] w-[min(92vw,460px)] animate-pulse rounded-md bg-paper/15" />
  ),
});

export type PhotoBookProps = {
  entries: (EntryPageData & { id: string })[];
  editEntries: EditEntryData[];
  maxPhotos: number;
  title: string;
  subtitle: string;
  botUsername?: string;
};

export function PhotoBook({
  entries,
  editEntries,
  maxPhotos,
  title,
  subtitle,
  botUsername,
}: PhotoBookProps) {
  const [api, setApi] = useState<FlipApi | null>(null);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState(false);
  const reduce = useReducedMotion();

  const onApi = useCallback((a: FlipApi) => setApi(a), []);
  const onFlip = useCallback((p: number) => setPage(p), []);

  const total = api?.total ?? Math.max(entries.length, 1) + 2;
  const lastIndex = total - 1;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") api?.next();
      else if (e.key === "ArrowLeft") api?.prev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [api]);

  const botLink = botUsername ? `https://t.me/${botUsername}` : null;

  const label =
    page <= 0 ? "Cover" : page >= lastIndex ? "The End" : `${page} of ${total - 2}`;

  return (
    <div className="lj-desk flex min-h-dvh flex-col">
      <header className="no-print z-20 flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <span className="font-display text-lg font-semibold text-[#f0e2c9]">{title}</span>
        <nav className="flex items-center gap-2">
          {editEntries.length > 0 ? (
            <button
              className="lj-btn lj-btn-ghost"
              onClick={() => setEditing(true)}
              aria-label="Edit recent memories"
            >
              <Pencil width={16} height={16} />
              <span className="hidden sm:inline">Edit</span>
            </button>
          ) : null}
          <a className="lj-btn lj-btn-ghost" href="/api/export/html" aria-label="Download as HTML">
            <Download width={16} height={16} />
            <span className="hidden sm:inline">HTML</span>
          </a>
          <a
            className="lj-btn lj-btn-ghost"
            href="/print"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Save as PDF"
          >
            <Printer width={16} height={16} />
            <span className="hidden sm:inline">PDF</span>
          </a>
        </nav>
      </header>

      <main className="flex flex-1 items-center justify-center px-3 py-1">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 26, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="w-full"
          style={{ perspective: 2200 }}
        >
          <Flipbook
            entries={entries}
            title={title}
            subtitle={subtitle}
            botUsername={botUsername}
            onApi={onApi}
            onFlip={onFlip}
          />
        </motion.div>
      </main>

      <footer className="no-print z-20 flex items-center justify-center gap-4 px-4 py-4">
        <button
          className="lj-btn lj-icon-btn"
          onClick={() => api?.prev()}
          disabled={page <= 0}
          aria-label="Previous page"
        >
          <ChevronLeft />
        </button>
        <span className="min-w-[88px] text-center font-body text-xs font-medium tracking-wider text-[#d8c4a4]">
          {label}
        </span>
        <button
          className="lj-btn lj-icon-btn"
          onClick={() => api?.next()}
          disabled={page >= lastIndex}
          aria-label="Next page"
        >
          <ChevronRight />
        </button>
      </footer>

      {botLink ? (
        <a
          href={botLink}
          target="_blank"
          rel="noopener noreferrer"
          className="lj-btn lj-btn-ghost no-print fixed bottom-5 right-5 z-30"
        >
          <Send width={16} height={16} />
          <span className="hidden sm:inline">Add a memory</span>
        </a>
      ) : null}

      <EditMemories
        open={editing}
        onClose={() => setEditing(false)}
        entries={editEntries}
        maxPhotos={maxPhotos}
      />
    </div>
  );
}
