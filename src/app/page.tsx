import { getEntriesWithUrls } from "@/lib/entries";
import { config } from "@/lib/config";
import { PhotoBook } from "@/components/PhotoBook";

// Always render fresh so new memories appear the moment the bot adds them.
export const dynamic = "force-dynamic";

export default async function Home() {
  let entries: Awaited<ReturnType<typeof getEntriesWithUrls>> = [];
  try {
    entries = await getEntriesWithUrls();
  } catch (err) {
    console.error("[home] could not load entries:", err);
  }

  const data = entries.map((e) => ({
    id: e.id,
    event_date: e.event_date,
    title: e.title,
    description: e.description,
    photoUrls: e.photoUrls,
  }));

  return (
    <PhotoBook
      entries={data}
      title={config.title}
      subtitle={config.subtitle}
      botUsername={config.botUsername || undefined}
    />
  );
}
