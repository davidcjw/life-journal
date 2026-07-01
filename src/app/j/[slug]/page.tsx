import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import { getJournalBySlug, getJournals } from "@/lib/journals";
import { loadJournalBook } from "@/lib/journal-page";
import { PhotoBook } from "@/components/PhotoBook";

// Always render fresh so new memories appear the moment the bot adds them.
export const dynamic = "force-dynamic";

export default async function JournalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const journal = await getJournalBySlug(slug);
  if (!journal) notFound();

  const journals = await getJournals();
  const { data, editEntries } = await loadJournalBook(journal);

  return (
    <PhotoBook
      entries={data}
      editEntries={editEntries}
      maxPhotos={config.maxPhotos}
      title={journal.title}
      subtitle={journal.subtitle}
      botUsername={config.botUsername || undefined}
      slug={journal.slug}
      journals={journals.map((j) => ({ slug: j.slug, title: j.title }))}
    />
  );
}
