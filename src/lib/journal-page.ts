import "server-only";
import { getEntriesWithUrls } from "./entries";
import type { Journal } from "./journals";

/** Props the web book + edit drawer need for one journal, ready for <PhotoBook />. */
export async function loadJournalBook(journal: Journal) {
  let entries: Awaited<ReturnType<typeof getEntriesWithUrls>> = [];
  try {
    entries = await getEntriesWithUrls(journal.id);
  } catch (err) {
    console.error(`[journal ${journal.slug}] could not load entries:`, err);
  }

  const data = entries.map((e) => ({
    id: e.id,
    event_date: e.event_date,
    title: e.title,
    description: e.description,
    photoUrls: e.photoUrls,
  }));

  // Editor list: most recently added memories first, capped to keep it focused.
  const RECENT_EDITABLE = 12;
  const editEntries = [...entries]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, RECENT_EDITABLE)
    .map((e) => ({
      id: e.id,
      event_date: e.event_date,
      title: e.title,
      description: e.description,
      photos: e.photoItems,
    }));

  return { data, editEntries };
}
