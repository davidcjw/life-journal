import { getEntriesWithUrls } from "@/lib/entries";
import { config } from "@/lib/config";
import { PhotoCollage } from "@/components/PhotoCollage";
import { PrintControls } from "@/components/PrintControls";
import { formatLongDate, monthLabel } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function PrintPage({
  searchParams,
}: {
  searchParams: Promise<{ auto?: string }>;
}) {
  const { auto } = await searchParams;

  let entries: Awaited<ReturnType<typeof getEntriesWithUrls>> = [];
  try {
    entries = await getEntriesWithUrls();
  } catch (err) {
    console.error("[print] could not load entries:", err);
  }

  return (
    <div className="lj-print-doc min-h-dvh">
      <PrintControls auto={auto === "1"} />

      {/* Cover */}
      <section className="lj-print-page lj-cover flex flex-col items-center justify-center p-16 text-center">
        <span className="foil-border foil mb-7 rounded-full border px-3 py-1 font-body text-[0.6rem] font-semibold uppercase tracking-[0.32em]">
          Live Journal
        </span>
        <h1 className="foil font-display text-5xl font-semibold leading-[1.05]">{config.title}</h1>
        <p className="mt-4 font-hand text-3xl text-[#ecce97]">{config.subtitle}</p>
        <div className="foil-border my-8 w-20 border-t" />
        <p className="font-body text-xs uppercase tracking-[0.28em] text-[#d6bb8c]">
          {entries.length} {entries.length === 1 ? "memory" : "memories"}
        </p>
      </section>

      {/* Entries */}
      {entries.map((e, i) => (
        <section
          key={e.id}
          className="lj-print-page flex flex-col border border-paper-edge bg-paper p-12"
        >
          <header className="flex items-baseline justify-between gap-4">
            <p className="font-hand text-3xl leading-none text-brown">
              {formatLongDate(e.event_date)}
            </p>
            <span className="font-body text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-faint">
              {monthLabel(e.event_date)}
            </span>
          </header>
          <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-ink">
            {e.title}
          </h2>
          <div className="mt-3 h-px w-16 bg-gold/50" />
          {e.description ? (
            <p className="mt-4 max-w-[62ch] font-body text-base leading-relaxed text-ink-soft">
              {e.description}
            </p>
          ) : null}
          <div className="mt-6 flex flex-1">
            <PhotoCollage photos={e.photoUrls} title={e.title} eager />
          </div>
          <span className="mt-6 self-end font-body text-[0.65rem] tracking-[0.2em] text-ink-faint">
            {i + 1}
          </span>
        </section>
      ))}

      {entries.length === 0 ? (
        <section className="lj-print-page flex flex-col items-center justify-center border border-paper-edge bg-paper p-16 text-center">
          <p className="font-hand text-3xl text-brown">your story starts here</p>
          <p className="mt-4 max-w-md font-body text-base text-ink-soft">
            Add your first memory through the Telegram bot and it will appear in your book.
          </p>
        </section>
      ) : null}
    </div>
  );
}
