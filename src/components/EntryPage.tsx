import { formatLongDate, monthLabel } from "@/lib/dates";
import { PhotoCollage } from "./PhotoCollage";
import { Sprig } from "./icons";

export type EntryPageData = {
  event_date: string;
  title: string;
  description: string | null;
  photoUrls: string[];
};

/** A single leaf in the flip-book (tuned for ~460×624). */
export function EntryPage({
  entry,
  pageNumber,
}: {
  entry: EntryPageData;
  pageNumber?: number;
}) {
  return (
    <div className="lj-page flex flex-col px-7 py-7">
      <header className="shrink-0">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-hand text-2xl leading-none text-brown">
            {formatLongDate(entry.event_date)}
          </p>
          <span className="font-body text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-ink-faint whitespace-nowrap">
            {monthLabel(entry.event_date)}
          </span>
        </div>
        <h2 className="mt-2 font-display text-[1.55rem] font-semibold leading-tight text-ink">
          {entry.title}
        </h2>
        <div className="mt-2 h-px w-14 bg-gold/50" />
      </header>

      {entry.description ? (
        <p className="mt-3 shrink-0 font-body text-[0.86rem] leading-relaxed text-ink-soft line-clamp-4">
          {entry.description}
        </p>
      ) : null}

      <div className="mt-4 flex min-h-0 flex-1">
        <PhotoCollage photos={entry.photoUrls} title={entry.title} />
      </div>

      <footer className="mt-3 flex shrink-0 items-center justify-between text-ink-faint">
        <Sprig width={15} height={15} className="opacity-50" />
        {pageNumber ? (
          <span className="font-body text-[0.6rem] tracking-[0.2em]">{pageNumber}</span>
        ) : (
          <span />
        )}
      </footer>
    </div>
  );
}
