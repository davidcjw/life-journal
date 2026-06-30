"use client";

import { forwardRef, useEffect, useRef, type ReactNode } from "react";
import HTMLFlipBook from "react-pageflip";
import { Cover, BackCover, EmptyLeaf } from "./Cover";
import { EntryPage, type EntryPageData } from "./EntryPage";

export type FlipApi = {
  next: () => void;
  prev: () => void;
  goto: (page: number) => void;
  total: number;
};

const Leaf = forwardRef<HTMLDivElement, { children: ReactNode; hard?: boolean }>(
  function Leaf({ children, hard }, ref) {
    return (
      <div ref={ref} className="h-full w-full" data-density={hard ? "hard" : "soft"}>
        {children}
      </div>
    );
  },
);

type Props = {
  entries: (EntryPageData & { id: string })[];
  title: string;
  subtitle: string;
  botUsername?: string;
  onApi?: (api: FlipApi) => void;
  onFlip?: (page: number) => void;
};

export default function Flipbook({
  entries,
  title,
  subtitle,
  botUsername,
  onApi,
  onFlip,
}: Props) {
  // react-pageflip exposes its instance via .pageFlip(); type it loosely.
  const ref = useRef<{ pageFlip: () => PageFlipInstance } | null>(null);

  useEffect(() => {
    if (!onApi) return;
    let raf = 0;
    let tries = 0;
    const init = () => {
      const inst = ref.current?.pageFlip?.();
      if (inst && typeof inst.getPageCount === "function" && inst.getPageCount() > 0) {
        onApi({
          next: () => ref.current?.pageFlip?.().flipNext(),
          prev: () => ref.current?.pageFlip?.().flipPrev(),
          goto: (p: number) => ref.current?.pageFlip?.().flip(p),
          total: inst.getPageCount(),
        });
        return;
      }
      if (tries++ < 90) raf = requestAnimationFrame(init);
    };
    init();
    return () => cancelAnimationFrame(raf);
  }, [onApi, entries.length]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Book = HTMLFlipBook as any;

  return (
    <Book
      ref={ref}
      width={460}
      height={624}
      minWidth={280}
      maxWidth={520}
      minHeight={380}
      maxHeight={720}
      size="stretch"
      showCover
      drawShadow
      maxShadowOpacity={0.5}
      flippingTime={750}
      usePortrait
      mobileScrollSupport
      useMouseEvents
      className="lj-book"
      onFlip={(e: { data: number }) => onFlip?.(e.data)}
    >
      <Leaf hard>
        <Cover title={title} subtitle={subtitle} count={entries.length} />
      </Leaf>

      {entries.length === 0 ? (
        <Leaf>
          <EmptyLeaf botUsername={botUsername} />
        </Leaf>
      ) : (
        entries.map((entry, i) => (
          <Leaf key={entry.id}>
            <EntryPage entry={entry} pageNumber={i + 1} />
          </Leaf>
        ))
      )}

      <Leaf hard>
        <BackCover />
      </Leaf>
    </Book>
  );
}

type PageFlipInstance = {
  flipNext: () => void;
  flipPrev: () => void;
  flip: (page: number) => void;
  getPageCount: () => number;
};
